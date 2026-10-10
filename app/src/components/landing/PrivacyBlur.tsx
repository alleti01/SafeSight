"use client";

import CompareSlider from "./CompareSlider";

export interface PrivacyPhoto {
  src: string;
  mask_url: string;
  width: number;
  height: number;
}

// The privacy step on a stock photo: the backend's person mask (blur.py) is
// applied here, blurring the photo inside the mask, so no blurred copy of
// someone's photo has to be stored. Blur strength matches blur.py: the long
// side / 30, as a share of the shown width.
export default function PrivacyBlur({ photo }: { photo: PrivacyPhoto }) {
  const mask = `url("${photo.mask_url}")`;
  return (
    <CompareSlider
      before={photo.src}
      after={
        <div className="absolute inset-0 overflow-hidden [container-type:inline-size]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover [filter:blur(3.4cqw)]" />
          </div>
        </div>
      }
      beforeLabel="Your video"
      afterLabel="What we keep"
      width={photo.width}
      height={photo.height}
      alt="An older woman at her front door, blurred out"
    />
  );
}
