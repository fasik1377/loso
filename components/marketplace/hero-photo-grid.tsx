import Image, { type StaticImageData } from "next/image";
import cameraMan from "@/public/images/camera_man.jpg";
import carpenter from "@/public/images/carpenter.jpg";
import cleaner from "@/public/images/cleaner.jpg";
import dishTv from "@/public/images/dishtv.jpg";
import driver from "@/public/images/driver.jpg";
import electrician from "@/public/images/electrician.jpg";
import mason from "@/public/images/mason.jpg";
import mechanic from "@/public/images/mechanic.jpg";
import officeWorker from "@/public/images/office_worker.jpg";
import pipe from "@/public/images/pipe.jpg";
import shoes from "@/public/images/shoes.jpg";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { cx } from "@/components/ui/primitives";

type PhotoKey = keyof Dictionary["hero"]["photos"];
type Photo = { src: StaticImageData; key: PhotoKey; tall?: boolean };

// Portrait photos get taller tiles so each column mixes shapes like a masonry grid.
const COLUMNS: Photo[][] = [
  [
    { src: carpenter, key: "carpenter", tall: true },
    { src: electrician, key: "electrician" },
    { src: cleaner, key: "cleaner", tall: true },
    { src: driver, key: "driver" },
  ],
  [
    { src: shoes, key: "shoeShiner" },
    { src: mason, key: "mason", tall: true },
    { src: dishTv, key: "satellite" },
    { src: officeWorker, key: "officeWorker", tall: true },
  ],
  [
    { src: pipe, key: "plumber", tall: true },
    { src: mechanic, key: "mechanic" },
    { src: cameraMan, key: "photographer" },
  ],
];

const SPEEDS = ["[animation-duration:46s]", "[animation-duration:58s]", "[animation-duration:52s]"];

/**
 * Hero photo wall: three columns that drift endlessly (alternating up/down) and pause on hover.
 * Each column is rendered twice in a row so translateY(-50%) loops seamlessly; the copy is aria-hidden.
 */
export function HeroPhotoGrid({ t }: { t: Dictionary["hero"] }) {
  return (
    <div
      className="group/grid relative h-[26rem] overflow-hidden sm:h-[32rem] lg:h-[36rem] [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
      role="img"
      aria-label={t.photoGridLabel}
    >
      <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {COLUMNS.map((column, ci) => (
          <div key={ci} className={cx("relative", ci === 2 && "hidden sm:block")}>
            <div
              className={cx(
                "flex flex-col gap-3 sm:gap-4 animate-scroll-up group-hover/grid:[animation-play-state:paused]",
                SPEEDS[ci],
                ci % 2 === 1 && "[animation-direction:reverse]",
              )}
            >
              {[0, 1].map((copy) =>
                column.map((p, i) => (
                  <figure
                    key={`${copy}-${p.key}`}
                    aria-hidden="true"
                    className={cx(
                      "group/photo relative w-full shrink-0 overflow-hidden rounded-2xl bg-white/5 shadow-lg ring-1 ring-white/10",
                      p.tall ? "aspect-[3/4]" : "aspect-[4/3]",
                    )}
                  >
                    <Image
                      src={p.src}
                      alt=""
                      placeholder="blur"
                      preload={copy === 0 && i === 0}
                      sizes="(min-width: 1024px) 15vw, (min-width: 640px) 28vw, 45vw"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/photo:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
                    <figcaption className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#182B43] shadow-sm backdrop-blur">
                      {t.photos[p.key]}
                    </figcaption>
                  </figure>
                )),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
