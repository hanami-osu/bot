import type { Embed } from "lilybird";
import type { BackgroundBuilderOptions } from "@type/builders";

export function backgroundBuilder({ beatmap }: BackgroundBuilderOptions): Array<Embed.Structure> {
    const { beatmapset } = beatmap;
    return [
        {
            author: {
                name: `${beatmapset.artist} - ${beatmapset.title} by ${beatmapset.creator}`,
                icon_url: `https://s.ppy.sh/a/${beatmapset.user_id}`,
                url: `https://osu.ppy.sh/b/${beatmap.id}`,
            },
            image: { url: `https://catboy.best/preview/background/${beatmapset.id}/set` },
        },
    ];
}
