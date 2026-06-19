import { EmbedType, type Embed } from "lilybird";

export function prefixListEmbed(prefixes: Array<string>): Embed.Structure {
    return {
        type: EmbedType.Rich,
        title: "Currently defined prefixes",
        description: `**\`${prefixes.join("`**, `")}\`**`,
    };
}
