import { buildUrl, generateUUID, isEmpty, isStr, logWarn } from '../src/utils.js';
import { BidderSpec, registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER, VIDEO } from '../src/mediaTypes.js';
import { getGlobal } from '../src/prebidGlobal.js';
import { isMainPageAccessible, copyDeepPaths, mapToPayloadBannerBid, mapToPayloadVideoBid } from '../libraries/stroeerCoreUtils/stroeerCoreUtils.js';
import { BasePayload } from '../libraries/stroeerCoreUtils/stroeerCoreTypes.js';
import { BIDDER_CODE, GVL_ID, DEFAULT_HOST, DEFAULT_PATH, DEFAULT_PORT, FIVE_MINUTES_IN_SECONDS, USER_SYNC_IFRAME_URL } from '../libraries/stroeerCoreUtils/constants.js';

export const spec: BidderSpec<typeof BIDDER_CODE> = {
  code: BIDDER_CODE,
  gvlid: GVL_ID,
  supportedMediaTypes: [BANNER, VIDEO],

  isBidRequestValid: (function () {
    const validators = [];

    const createValidator = (checkFn, msg) => {
      return (bidRequest) => {
        if (checkFn(bidRequest)) {
          return true;
        } else {
          logWarn(`${BIDDER_CODE}: Bid setup for ${bidRequest.adUnitCode} is invalid: ${msg}`);
          return false;
        }
      };
    };

    const hasValidMediaType = bidReq => hasBanner(bidReq) || hasVideo(bidReq);

    validators.push(createValidator((bidReq) => hasValidMediaType(bidReq),
      'the media type is invalid'));
    validators.push(createValidator((bidReq) => typeof bidReq.params === 'object',
      'the custom params does not exist'));
    validators.push(createValidator((bidReq) => isStr(bidReq.params.sid),
      'the sid field must be a string'));

    return function (bidRequest) {
      return validators.every(f => f(bidRequest));
    };
  }()),

  // TODO: This should not be any
  buildRequests: function (validBidRequests = [], bidderRequest: any) {
    const anyBid = bidderRequest.bids[0];

    const refererInfo = bidderRequest.refererInfo;

    const basePayload: BasePayload = {
      id: generateUUID(),
      ref: refererInfo.ref,
      mpa: isMainPageAccessible(),
      timeout: bidderRequest.timeout - (Date.now() - bidderRequest.auctionStart),
      url: refererInfo.page,
      schain: anyBid?.ortb2?.source?.ext?.schain,
      ver: {
        pb: getGlobal().version,
      },
    };

    const eids = anyBid.userIdAsEids;

    // Note make it a one liner? basePayload.user.eids = eids ? should work? Also, isn't an empty object falsy?
    if (!isEmpty(eids)) {
      basePayload.user = {
        eids: eids
      };
    }

    const gdprConsent = bidderRequest.gdprConsent;

    if (gdprConsent) {
      basePayload.gdpr = {
        consent: gdprConsent.consentString,
        applies: gdprConsent.gdprApplies
      };
    }

    const ORTB2_PATHS = ['regs.ext.dsa', 'site.ext', 'source.tid'];
    copyDeepPaths(basePayload, bidderRequest.ortb2, ORTB2_PATHS, 'ortb2');

    const bannerBids = validBidRequests
      .filter(hasBanner)
      .map(mapToPayloadBannerBid);

    const videoBids = validBidRequests
      .filter(hasVideo)
      .map(mapToPayloadVideoBid);

    return {
      method: 'POST',
      url: buildEndpointUrl(anyBid.params),
      data: { ...basePayload, bids: [...bannerBids, ...videoBids] }
    };
  },

  interpretResponse: function (serverResponse) {
    const bids = [];

    if (serverResponse.body && typeof serverResponse.body === 'object') {
      serverResponse.body.bids.forEach(bidResponse => {
        const mediaType = bidResponse.vastXml != null ? VIDEO : BANNER;

        // TODO: define type
        const bid: any = {
          requestId: bidResponse.bidId,
          cpm: bidResponse.cpm || 0,
          width: bidResponse.width || 0,
          height: bidResponse.height || 0,
          ttl: FIVE_MINUTES_IN_SECONDS,
          currency: 'EUR',
          netRevenue: true,
          creativeId: '',
          meta: { ...bidResponse.meta },
          mediaType,
        };

        if (mediaType === VIDEO) {
          bid.vastXml = bidResponse.vastXml;
        } else {
          bid.ad = bidResponse.ad;
        }

        bids.push(bid);
      });
    }

    return bids;
  },

  getUserSyncs: function (syncOptions, serverResponses, gdprConsent) {
    if (serverResponses.length > 0 && syncOptions.iframeEnabled) {
      return [{
        type: 'iframe',
        url: USER_SYNC_IFRAME_URL + getGdprParams(gdprConsent)
      }];
    }

    return [];
  }
};

const buildEndpointUrl = ({ host: hostname = DEFAULT_HOST, port = DEFAULT_PORT, securePort, path: pathname = DEFAULT_PATH }) => {
  if (securePort) {
    port = securePort;
  }

  return buildUrl({ protocol: 'https', hostname, port, pathname });
};

const getGdprParams = gdprConsent => {
  if (gdprConsent) {
    const consentString = encodeURIComponent(gdprConsent.consentString || '');
    const isGdpr = gdprConsent.gdprApplies ? 1 : 0;

    return `?gdpr=${isGdpr}&gdpr_consent=${consentString}`;
  } else {
    return '';
  }
};

const hasBanner = bidReq => {
  return (!bidReq.mediaTypes && !bidReq.mediaType) ||
    (bidReq.mediaTypes && bidReq.mediaTypes.banner) ||
    bidReq.mediaType === BANNER;
};

const hasVideo = bidReq => {
  const mediaTypes = bidReq.mediaTypes;
  return mediaTypes &&
    mediaTypes.video &&
    ['instream', 'outstream'].indexOf(mediaTypes.video.context) > -1;
};

registerBidder(spec);
