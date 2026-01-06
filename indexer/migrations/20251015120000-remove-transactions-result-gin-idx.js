'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS transactions_result_gin_idx;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS transactions_result_gin_idx ON "Transactions" USING gin (result);
    `);
  },
};
