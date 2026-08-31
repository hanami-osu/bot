import { ApplicationCommandOptionType } from "lilybird";
import type { ApplicationCommandRegistrationData } from "@type/commands";

type ApplicationCommandOption = NonNullable<ApplicationCommandRegistrationData["options"]>[number];

const OSU_MODE_CHOICES = [
    { name: "osu", value: "osu" },
    { name: "mania", value: "mania" },
    { name: "taiko", value: "taiko" },
    { name: "ctb", value: "fruits" },
];

const MODS_ACTION_CHOICES = [
    {
        name: "Include",
        value: "include",
    },
    {
        name: "Force Include",
        value: "force_include",
    },
    {
        name: "Exclude",
        value: "exclude",
    },
];

export function usernameOption(): ApplicationCommandOption {
    return {
        type: ApplicationCommandOptionType.STRING,
        name: "username",
        description: "Specify an osu! username",
    };
}

export function modeOption(): ApplicationCommandOption {
    return {
        type: ApplicationCommandOptionType.STRING,
        name: "mode",
        description: "Specify an osu! mode",
        choices: OSU_MODE_CHOICES,
    };
}

export function modsOption(): ApplicationCommandOption {
    return {
        type: ApplicationCommandOptionType.STRING,
        name: "mods",
        description: "Specify a mods combination.",
        min_length: 2,
    };
}

export function modsActionOption(): ApplicationCommandOption {
    return {
        type: ApplicationCommandOptionType.STRING,
        name: "mods_action",
        description: "Specify the action to perform on the mods combination.",
        choices: MODS_ACTION_CHOICES,
    };
}

export function gradeOption(): ApplicationCommandOption {
    return {
        type: ApplicationCommandOptionType.STRING,
        name: "grade",
        description: "Consider scores only with this grade.",
        choices: ["SS", "S", "A", "B", "C", "D"].map(grade => ({ name: grade, value: grade })),
    };
}

export function filterOption(): ApplicationCommandOption {
    return {
        type: ApplicationCommandOptionType.STRING,
        name: "filter",
        description: "Filter plays by beatmap title.",
    };
}

export function discordOption(): ApplicationCommandOption {
    return {
        type: ApplicationCommandOptionType.USER,
        name: "discord",
        description: "Specify a linked Discord user",
    };
}
