-- Additive canonical Hanami identity cache for Bot users.
ALTER TABLE `users`
    ADD COLUMN `hanami_user_id` VARCHAR(255) NULL,
    ADD COLUMN `identity_synced_at` DATETIME(3) NULL,
    ADD COLUMN `identity_version` INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX `users_hanami_user_id_key` ON `users`(`hanami_user_id`);
