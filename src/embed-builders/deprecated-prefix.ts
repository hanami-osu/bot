import { getSlashCommandMention } from "../state/command-registry";
import type { Embed } from "lilybird";

export function deprecatedEmbed(commandName: string): Array<Embed.Structure> {
    return [
        {
            description: `This prefix command has been deprecated. Use ${getSlashCommandMention(commandName)} instead.`,
        },
    ];
}
