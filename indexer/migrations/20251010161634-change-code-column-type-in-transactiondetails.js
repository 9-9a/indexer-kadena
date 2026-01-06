'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'TransactionDetails'
          AND column_name = 'code'
          AND data_type = 'text'
        ) THEN
          RAISE NOTICE 'Column code is already TEXT type, skipping conversion';
        ELSE
          ALTER TABLE "TransactionDetails"
          ALTER COLUMN code TYPE TEXT
          USING CASE
            WHEN code = '{}'::jsonb THEN NULL
            ELSE code::text
          END;
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "TransactionDetails"
      ALTER COLUMN code TYPE JSONB
      USING CASE
        WHEN code = '' THEN NULL
        ELSE code::jsonb
      END
    `);
  },
};
