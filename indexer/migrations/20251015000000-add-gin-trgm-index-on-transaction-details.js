'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS transactiondetails_code_gin_idx;');
    await queryInterface.sequelize.query(
      'CREATE INDEX transactiondetails_code_trgm_idx ON "TransactionDetails" USING gin (code gin_trgm_ops);',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS transactiondetails_code_trgm_idx;');
    await queryInterface.sequelize.query(
      'CREATE INDEX transactiondetails_code_gin_idx ON "TransactionDetails" USING gin (code);',
    );
  },
};
