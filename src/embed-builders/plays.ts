import { SPACE } from "@utils/constants";
import { EmbedScoreType } from "@type/database";
import { ITEMS_PER_PAGE } from "@utils/pagination";
import { EmbedType } from "lilybird";
import type { User } from "@type/database";
import type { Mode, ProfileInfo, ScoresInfo } from "@type/osu";
import type { PlaysBuilderOptions } from "@type/builders";
import type { Embed } from "lilybird";

export async function playBuilder({ plays, profile, mode, index, isMultiple, page, authorDb, totalPlays }: PlaysBuilderOptions): Promise<Array<Embed.Structure>> {
    if (typeof page === "undefined" && typeof index === "undefined") {
        if (isMultiple) page = 0;
        else index = 0;
    }

    if (totalPlays === 0) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: `No plays matched those filters for \`${profile.username}\` in \`${mode}\`.`,
            },
        ] satisfies Array<Embed.Structure>;
    }

    if (typeof index !== "undefined" && (index < 0 || index >= totalPlays)) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: `That play index is out of range for \`${profile.username}\`.`,
            },
        ] satisfies Array<Embed.Structure>;
    }

    if (typeof page !== "undefined" && (page < 0 || page * ITEMS_PER_PAGE >= totalPlays)) {
        return [
            {
                type: EmbedType.Rich,
                title: "Uh oh! :x:",
                description: `That page is out of range for \`${profile.username}\`.`,
            },
        ] satisfies Array<Embed.Structure>;
    }

    return typeof page !== "undefined"
        ? getMultiplePlays({ plays, page, mode, profile, authorDb, totalPlays })
        : getSinglePlay({ index: index ?? 0, play: plays[0], profile, authorDb, isMultiple, totalPlays });
}

async function getSinglePlay({
    index,
    play,
    profile,
    authorDb,
    isMultiple,
    totalPlays,
}: {
    play: ScoresInfo;
    profile: ProfileInfo;
    index: number;
    authorDb: User | null;
    isMultiple?: boolean;
    totalPlays: number;
}): Promise<Array<Embed.Structure>> {
    const isMaximized = (authorDb?.score_embeds ?? 1) === 1;
    const embedType = authorDb?.embed_type ?? EmbedScoreType.Hanami;

    const { performance } = play;
    const bpm = performance ? performance.difficultyAttrs.clockRate * performance.mapValues.bpm : null;

    if (embedType === EmbedScoreType.Hanami) {
        const author = {
            name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
            url: profile.userUrl,
            icon_url: profile.avatarUrl,
        } satisfies Embed.AuthorStructure;

        const line1 = `${play.grade} ${play.percentagePassed !== null ? `**@${play.percentagePassed}%**` : ""} ${SPACE} ${play.score} ${SPACE} **${play.accuracy}%** ${SPACE} ${play.playSubmitted}\n`;
        const line2 = `${play.ppFormatted} ${SPACE} [${play.comboValues}] ${SPACE} {${play.hitValues}}\n`;
        const line3 = `${play.ifFcHanami ?? ""}\n`;

        const fields = [
            {
                name: `${play.rulesetEmote} ${play.difficultyName} **+${play.mods.join("")}** [${play.stars}] ${isMultiple ? `${SPACE} Top **__#${play.position}__** of ${totalPlays}` : ""}`,
                value: line1 + line2,
                inline: false,
            },
        ] satisfies Array<Embed.FieldStructure>;

        if (isMaximized) {
            fields[0].value += line3;
            if (performance && bpm !== null) {
                const beatmapInfoField = [
                    `**BPM:** \`${bpm.toFixed().toLocaleString()}\` ${SPACE} **Length:** \`${play.drainLength}\``,
                    `**AR:** \`${performance.difficultyAttrs.ar.toFixed(1)}\` ${SPACE} **OD:** \`${performance.difficultyAttrs.od.toFixed(1)}\` ${SPACE} **CS:** \`${performance.difficultyAttrs.cs.toFixed(
                        1,
                    )}\` ${SPACE} **HP:** \`${performance.difficultyAttrs.hp.toFixed(1)}\``,
                ];
                fields.push({
                    name: "Beatmap Info:",
                    value: beatmapInfoField.join("\n"),
                    inline: false,
                });
            }
        }

        const image = isMaximized ? ({ url: play.coverLink } satisfies Embed.ImageStructure) : undefined;
        const thumbnail = !isMaximized ? ({ url: play.listLink } satisfies Embed.ThumbnailStructure) : undefined;
        const title = play.songNameFormatted;
        const url = play.mapLink;
        const footer: Embed.FooterStructure = {
            text: `${play.mapStatus} mapset by ${play.mapAuthor}${isMaximized && !isMultiple ? ` ${SPACE} - Play ${index + 1} of ${totalPlays} ${SPACE} - Try ${play.retries}` : ""}`,
        };

        return [{ type: EmbedType.Rich, author, fields, image, thumbnail, footer, url, title }];
    }

    if (embedType === EmbedScoreType.Bathbot && isMaximized) {
        const fields = [
            { name: "Grade", value: `${play.grade} ${play.percentagePassed !== null ? `@${play.percentagePassed}%` : ""} +${play.mods.join("")}`, inline: true },
            { name: "Score", value: play.score, inline: true },
            { name: "Acc", value: `${play.accuracy}%`, inline: true },
            { name: "PP", value: `${play.ppFormatted}`, inline: true },
            { name: "Combo", value: `${play.comboValues}`, inline: true },
            { name: "Hits", value: `{${play.hitValues}}`, inline: true },
        ];

        if (!play.isFc && play.ifFcBathbot) {
            fields.push({ name: "If FC: PP", value: play.ifFcBathbot ?? "", inline: true });
            fields.push({ name: "Acc", value: `${play.fcAccuracy}%`, inline: true });
            fields.push({ name: "Hits", value: `{${play.fcHitValues}}`, inline: true });
        }

        if (performance && bpm !== null) {
            const beatmapInfoField = [
                `Length: \`${play.drainLength}\` ${SPACE} BPM: \`${bpm.toFixed().toLocaleString()}\` ${SPACE} Objects \`${performance.mapValues.nObjects}\``,
                `AR: \`${performance.difficultyAttrs.ar.toFixed(1)}\` ${SPACE} OD: \`${performance.difficultyAttrs.od.toFixed(1)}\` ${SPACE} CS: \`${performance.difficultyAttrs.cs.toFixed(
                    1,
                )}\` ${SPACE} HP: \`${performance.difficultyAttrs.hp.toFixed(1)}\` Stars: ${play.stars}`,
            ];
            fields.push({ name: "Map Info", value: beatmapInfoField.join("\n"), inline: false });
        }

        return [
            {
                type: EmbedType.Rich,
                author: {
                    name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}${profile.countryRank})`,
                    url: profile.userUrl,
                    icon_url: profile.flagUrl,
                },
                title: `${play.songNameFormatted} [${play.difficultyName}]`,
                url: play.mapLink,
                image: { url: play.coverLink },
                fields,
            },
        ];
    } else if (embedType === EmbedScoreType.Bathbot) {
        return [
            {
                type: EmbedType.Rich,
                author: {
                    name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}${profile.countryRank})`,
                    url: profile.userUrl,
                    icon_url: profile.flagUrl,
                },
                title: `${play.songNameFormatted} [${play.difficultyName}] [${play.stars}]`,
                url: play.mapLink,
                thumbnail: { url: play.listLink },
                fields: [
                    {
                        name: `${play.grade} ${play.percentagePassed !== null ? `@${play.percentagePassed}%` : ""} ${SPACE} ${play.score} ${SPACE} (${play.accuracy}%) ${SPACE} ${play.playSubmitted}`,
                        value: `${play.ppFormatted} [ ${play.comboValues} ] {${play.hitValues}}`,
                    },
                ],
            },
        ];
    }

    // it's owo, so return owo embed.
    const desc = [
        `▸ ${play.grade} ${play.percentagePassed !== null ? `(${play.percentagePassed}%)` : ""} ▸ ${play.ppFormatted} ${play.ifFcOwo ?? ""} ▸ ${play.accuracy}%`,
        `▸ ${play.score} ▸ ${play.comboValues} ▸ [${play.hitValues}]`,
    ];

    return [
        {
            type: EmbedType.Rich,
            author: {
                name: `${play.songName} [${play.songArtist}] +${play.mods.join("")} [${play.stars}]`,
                url: play.mapLink,
                icon_url: profile.avatarUrl,
            },
            thumbnail: { url: play.thumbLink },
            description: desc.join("\n"),
            footer: { text: `Try #${play.retries} • On osu! Bancho` },
        },
    ];
}

async function getMultiplePlays({
    plays,
    page,
    mode,
    profile,
    authorDb,
    totalPlays,
}: {
    plays: Array<ScoresInfo>;
    page: number;
    mode: Mode;
    profile: ProfileInfo;
    authorDb: User | null;
    totalPlays: number;
}): Promise<Array<Embed.Structure>> {
    const embedType = authorDb?.embed_type ?? EmbedScoreType.Hanami;

    if (embedType === EmbedScoreType.Hanami) {
        let description = "";
        for (const playResult of plays) {
            const line1 = `**#${playResult.position} [${playResult.songName} [${playResult.difficultyName}]](${playResult.mapLink}) +${playResult.mods.join("")} ${playResult.stars}**\n`;
            const line2 = `${playResult.grade} ${playResult.ppFormatted} ${SPACE} ${playResult.score} ${SPACE} **${playResult.accuracy}%**\n`;
            const line3 = `${playResult.hitValues} ${SPACE} ${playResult.comboValues} ${SPACE} ${playResult.playSubmitted}`;

            description += `${line1 + line2 + line3}\n`;
        }

        return [
            {
                type: EmbedType.Rich,
                author: {
                    name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
                    url: profile.userUrl,
                    icon_url: profile.flagUrl,
                },
                thumbnail: { url: profile.avatarUrl },
                description,
                footer: { text: `Page ${page + 1} of ${Math.ceil(totalPlays / ITEMS_PER_PAGE)}` },
            },
        ];
    }

    if (embedType === EmbedScoreType.Bathbot) {
        let description = "";
        for (const playResult of plays) {
            const line1 = `**#${playResult.position} [${playResult.songName} [${playResult.difficultyName}]](${playResult.mapLink}) +${playResult.mods.join("")}** [${playResult.stars}]\n`;
            const line2 = `${playResult.grade} ${playResult.ppFormatted} • ${playResult.accuracy}% • ${playResult.score}\n`;
            const line3 = `[ ${playResult.comboValues} ] • {${playResult.hitValues}} • ${playResult.playSubmitted}`;

            description += `${line1 + line2 + line3}\n`;
        }

        return [
            {
                type: EmbedType.Rich,
                author: {
                    name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
                    url: profile.userUrl,
                    icon_url: profile.flagUrl,
                },
                thumbnail: { url: profile.avatarUrl },
                description,
                footer: { text: `Page ${page + 1} of ${Math.ceil(totalPlays / ITEMS_PER_PAGE)} • Mode: ${mode}` },
            },
        ];
    }

    // it's owo, so return owo embed.
    let description = "";
    for (const playResult of plays) {
        const line1 = `**${playResult.position}) [${playResult.songName} [${playResult.difficultyName}]](${playResult.mapLink}) +${playResult.mods.join("")}** [${playResult.stars}]\n`;
        const line2 = `**▸ ${playResult.grade} ▸ ${playResult.ppFormatted}**${playResult.ifFcOwo ? ` _${playResult.ifFcOwo}_` : " "} ▸ ${playResult.accuracy}%\n`;
        const line3 = `▸ ${playResult.score} x${playResult.comboValues} ▸ [${playResult.hitValues}]\n`;
        const line4 = `▸ Score set ${playResult.playSubmitted}`;

        description += `${line1 + line2 + line3 + line4}\n`;
    }

    return [
        {
            type: EmbedType.Rich,
            author: {
                name: `${profile.username} ${profile.pp}pp (#${profile.globalRank} ${profile.countryCode}#${profile.countryRank})`,
                url: profile.userUrl,
                icon_url: profile.flagUrl,
            },
            thumbnail: { url: profile.avatarUrl },
            description,
            footer: { text: `On osu! Bancho | Page ${page + 1} of ${Math.ceil(totalPlays / ITEMS_PER_PAGE)}` },
        },
    ];
}
