ALTER TABLE "login_attempts" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "login_attempts" ADD COLUMN "user_agent" VARCHAR(255);
