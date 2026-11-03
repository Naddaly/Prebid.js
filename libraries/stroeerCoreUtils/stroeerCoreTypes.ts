import type { ORTBRequest } from '../../src/prebid.public.js';
import { DeepPartial } from '../../src/types/objects.js';
import { BIDDER_CODE } from './constants.js';

export interface BasePayload {
  id: string;
  ref: string;
  mpa: boolean;
  timeout: number;
  url: string;
  schain?: ORTBRequest["source"]["schain"];
  ver: {
    pb: string;
  };
  user?: {
    eids?: NonNullable<ORTBRequest["user"]>["eids"];
    data?: NonNullable<ORTBRequest["user"]>["data"];
  };
  gdpr?: {
    consent: string;
    applies: boolean;
  };
  ortb2?: DeepPartial<ORTBRequest> // StroeerCoreORTB2;
};

export interface StroeerCoreORTB2 {
  regs?: {
    ext?: {
      dsa?: Record<string, unknown>;
    };
  };
  device?: {
    ext?: {
      cdep?: string;
    };
    ifa?: string;
  };
  source?: {
    tid?: string;
    ext?: {
      schain?: ORTBRequest["source"]["schain"];
    }
  };
  site?: {
    ext?: {
      data?: Record<string, unknown>;
    };
  };
};

export interface StroeerCoreBid {
  bid: string;
  sid: string;
  viz?: boolean;
  siz?: number[][];
  ban?: Banner;
  vid?: Video;
  ctx?: BrowserRequestInventoryContext;
  kvl?: Record<string, string[]>;
  sfp?: {
    websiteFeatures?: Record<string, object>;
  };
  tid?: string;
  ortb2Imp?: {
    ext?: {
      gpid?: string;
    };
  };
};

export type StroeerCoreBidParams = {
  sid: string;
  host?: string;
  securePort?: string | number;
  path?: string;
  sfp?: {
    websiteFeatures?: Record<string, object>;
  }
};

export interface Banner {
  siz: number[][];
  fp?: FloorPrice;
};

export interface Video {
  ctx: string;
  siz?: number[] | number[][]; // TODO: check incompatibility with our types
  mim?: string[];
  fp?: FloorPrice;
};

export interface FloorPrice {
  cur?: string;
  def?: number;
  siz?: FloorPriceForSize[];
};

export interface FloorPriceForSize {
  w: number;
  h: number;
  p: number;
};

export interface BrowserRequestInventoryContext {
  position?: string;
  adUnits?: string[];
  zone?: string;
  pageType?: string;
};

declare module '../../src/adUnits' {
  interface BidderParams {
    [BIDDER_CODE]: StroeerCoreBidParams;
  }
};
