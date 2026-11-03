import { getWindowTop, deepSetValue, deepAccess, getWindowSelf, getWinDimensions } from '../../src/utils.js';
import { getBoundingClientRect } from '../../libraries/boundingClientRect/boundingClientRect.js';

import type { BidRequest } from '../../src/prebid.public.js';
import { StroeerCoreBid } from './stroeerCoreTypes.js';
import { BIDDER_CODE } from './constants.js';

import { BANNER, VIDEO, type MediaType } from '../../src/mediaTypes.js';
import type { VideoMediaType } from '../../src/video.ts';

export const isMainPageAccessible = (): boolean => {
  try {
    return !!getWindowTop().location.href;
  } catch (ignore) {
    return false;
  }
};

const elementInView = (elementId) => {
  // TODO this should use getAdUnitElement
  const resolveElement = (elId) => {
    const win = getWindowSelf();

    return win.document.getElementById(elId);
  };

  const visibleInWindow = (el, win) => {
    const rect = getBoundingClientRect(el);
    const inView = (rect.top + rect.height >= 0) && (rect.top <= getWinDimensions().innerHeight);

    if (win !== win.parent) {
      return inView && visibleInWindow(win.frameElement, win.parent);
    }

    return inView;
  };

  try {
    return visibleInWindow(resolveElement(elementId), getWindowSelf());
  } catch (e) {
    // old browser, element not found, cross-origin etc.
  }
  return undefined;
};

const mapToPayloadBaseBid = (bidRequest: BidRequest<typeof BIDDER_CODE>): StroeerCoreBid => {
  const bid: StroeerCoreBid = {
    bid: bidRequest.bidId,
    sid: bidRequest.params.sid,
    viz: elementInView(bidRequest.adUnitCode),
    sfp: bidRequest.params.sfp,
    tid: bidRequest.transactionId,
  };
  copyDeepPaths(bid, bidRequest.ortb2Imp, ['ext.gpid'], 'ortb2Imp');
  return bid;
};

export const mapToPayloadBannerBid = (bidRequest: BidRequest<typeof BIDDER_CODE>): StroeerCoreBid => {
  const sizes: number[][] = deepAccess(bidRequest, 'mediaTypes.banner.sizes') || [];
  return ({
    ban: {
      siz: sizes,
      fp: createFloorPriceObject(BANNER, sizes, bidRequest)
    },
    ...mapToPayloadBaseBid(bidRequest)
  });
};

export const mapToPayloadVideoBid = (bidRequest: BidRequest<typeof BIDDER_CODE>): StroeerCoreBid => {
  const video: VideoMediaType = deepAccess(bidRequest, 'mediaTypes.video') || {};
  return {
    vid: {
      ctx: video.context,
      siz: video.playerSize,
      mim: video.mimes,
      fp: createFloorPriceObject(VIDEO, [video.playerSize as number[]], bidRequest),
    },
    ...mapToPayloadBaseBid(bidRequest)
  };
};

// check if types from stroeerCoreTypes can be reused here
type SizeFloor = {
  floor?: number;
  currency?: string;
  size: number[];
};

type FloorPriceObject = {
  def?: number;
  cur: string;
  siz: { w: number; h: number; p: number }[];
};

const createFloorPriceObject = (
  mediaType: MediaType,
  sizes: number[][],
  bidRequest: BidRequest<typeof BIDDER_CODE>
): FloorPriceObject | undefined => {
  if (!bidRequest.getFloor) {
    return undefined;
  }

  const defaultFloor: Partial<SizeFloor> = bidRequest.getFloor({
    currency: 'EUR',
    mediaType: mediaType,
    size: '*'
  }) || {};

  const sizeFloors: SizeFloor[] = sizes.map(size => {
    const floor = bidRequest.getFloor({
      currency: 'EUR',
      mediaType: mediaType,
      size: [size[0], size[1]]
    }) || {};
    return { ...floor, size };
  });

  const floorWithCurrency = (([defaultFloor].concat(sizeFloors)) || []).find(floor => floor.currency);

  if (!floorWithCurrency) {
    return undefined;
  }

  const currency = floorWithCurrency.currency;
  const defaultFloorPrice = defaultFloor.currency === currency ? defaultFloor.floor : undefined;

  return {
    def: defaultFloorPrice,
    cur: currency,
    siz: sizeFloors
      .filter(sizeFloor => sizeFloor.currency === currency)
      .filter(sizeFloor => sizeFloor.floor !== defaultFloorPrice)
      .map(sizeFloor => ({
        w: sizeFloor.size[0],
        h: sizeFloor.size[1],
        p: sizeFloor.floor
      }))
  };
};

export const copyDeepPaths = (target: object, source: object, paths: string[], targetPrefix: string = '') => {
  paths.forEach(path => {
    const value = deepAccess(source, path);
    if (value !== undefined) {
      const targetPath = targetPrefix
        ? `${targetPrefix}.${path}`
        : path;

      deepSetValue(target, targetPath, value);
    }
  });
};
