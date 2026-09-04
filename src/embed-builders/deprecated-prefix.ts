import { getSlashCommandMention } from "../state/command-registry";
import type { Embed } from "lilybird";
import { simpleWarningEmbed } from "./common";

export function deprecatedEmbed(commandName: string): Array<Embed.Structure> {
    return [
        simpleWarningEmbed(
            `This prefix command has been retired. Use ${getSlashCommandMention(commandName)} instead.`,
            "Prefix command retired",
        ),
    ];
}
