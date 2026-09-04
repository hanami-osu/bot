import { EmbedType, type Embed } from "lilybird";
import { EMBED_COLORS } from "./common";

export function prefixListEmbed(prefixes: Array<string>): Embed.Structure {
    return {
        type: EmbedType.Rich,
        title: "Currently defined prefixes",
        description: `**\`${prefixes.join("`**, `")}\`**`,
        color: EMBED_COLORS.brand,
    };
}
