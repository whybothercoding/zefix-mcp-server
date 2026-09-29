/**
 * @fileoverview Mock API responses for testing.
 * 
 * Provides mock implementations of Zefix and UID Webservice APIs
 * to avoid making real API calls during tests.
 * 
 * @module tests/helpers/mock-apis
 */

import companies from '../fixtures/companies.json' assert { type: 'json' };

/**
 * Mock Zefix API client.
 * Returns predefined responses based on input parameters.
 */
export class MockZefixClient {
  /**
   * Mock company search.
   * 
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Mock search results
   */
  async searchCompanies(params) {
    if (params.name === 'Migros') {
      return companies.searchResults;
    }
    if (params.name === 'NonExistent') {
      return [];
    }
    return companies.searchResults;
  }

  /**
   * Mock get company by UID.
   * 
   * @param {string} uid - Company UID
   * @returns {Promise<Object>} Mock company data
   */
  async getCompanyByUid(uid) {
    if (uid === companies.validCompany.uid) {
      return companies.validCompany;
    }
    if (uid === companies.inactiveCompany.uid) {
      return companies.inactiveCompany;
    }
    throw new Error('Company not found');
  }

  /**
   * Mock get daily registrations.
   * 
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} Mock registrations
   */
  async getDailyRegistrations(date) {
    return [
      {
        uid: 'CHE-123.456.789',
        name: 'New Company AG',
        type: 'registration',
        date,
      },
    ];
  }

  /**
   * Mock get company publications.
   * 
   * @param {string} uid - Company UID
   * @returns {Promise<Array>} Mock publications
   */
  async getCompanyPublications(uid) {
    return [
      {
        uid,
        date: '2025-01-15',
        type: 'modification',
        description: 'Change of address',
      },
    ];
  }
}

/**
 * Mock UID Webservice client.
 * Returns predefined responses based on input parameters.
 */
export class MockUidClient {
  /**
   * Mock validate UID.
   * 
   * @param {string} uid - UID to validate
   * @returns {Promise<Object>} Mock validation result
   */
  async validateUid(uid) {
    if (uid === companies.validCompany.uid) {
      return {
        valid: true,
        status: 'Active',
        uid,
      };
    }
    if (uid === companies.inactiveCompany.uid) {
      return {
        valid: true,
        status: 'Inactive',
        uid,
      };
    }
    return {
      valid: false,
      status: 'Not found',
      uid,
    };
  }

  /**
   * Mock validate VAT number.
   * 
   * @param {string} vatNumber - VAT number to validate
   * @returns {Promise<Object>} Mock validation result
   */
  async validateVatNumber(vatNumber) {
    if (vatNumber === companies.validCompany.uid) {
      return {
        valid: true,
        active: true,
        vatNumber,
      };
    }
    return {
      valid: false,
      active: false,
      vatNumber,
    };
  }

  /**
   * Mock get company details.
   * 
   * @param {string} uid - Company UID
   * @returns {Promise<Object>} Mock company details
   */
  async getCompanyDetails(uid) {
    if (uid === companies.validCompany.uid) {
      return {
        uid,
        name: companies.validCompany.name,
        legalForm: companies.validCompany.legalForm,
        status: companies.validCompany.status,
        address: companies.validCompany.address,
        vatRegistered: true,
        nogaCodes: ['64.19.0'],
      };
    }
    throw new Error('Company not found');
  }

  /**
   * Mock advanced search.
   * 
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Mock search results
   */
  async advancedSearch(params) {
    if (params.organisationName === 'Migros') {
      return companies.searchResults.map(company => ({
        ...company,
        vatRegistered: true,
        nogaCodes: ['64.19.0'],
      }));
    }
    return [];
  }
}

/**
 * Create mock API clients for testing.
 * 
 * @returns {Object} Object with mock clients
 */
export function createMockClients() {
  return {
    zefixClient: new MockZefixClient(),
    uidClient: new MockUidClient(),
  };
}
