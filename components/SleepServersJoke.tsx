import Image from "next/image";
import sleepServers from "@/public/sleep-servers-full.gif";
import { Panel } from "@/components/ui";

/**
 * Temporary gag for the landing page.
 *
 * To remove: delete this file, its <SleepServersJoke /> usage and import in
 * app/page.tsx, and public/sleep-servers-full.gif.
 */
export function SleepServersJoke() {
  return (
    <section className="flex w-full max-w-5xl flex-col items-center pb-14">
      <Panel className="overflow-hidden p-3">
        <Image
          src={sleepServers}
          alt="Sleep servers full"
          // Animated GIF: skip the optimizer or it collapses to a still frame.
          unoptimized
          priority={false}
          className="h-auto w-full max-w-[380px] rounded-lg"
        />
      </Panel>
      <p className="mt-4 font-display text-xs font-semibold tracking-[0.3em] text-gold-500">
        THE BEDS ARE OCCUPIED
      </p>
    </section>
  );
}
