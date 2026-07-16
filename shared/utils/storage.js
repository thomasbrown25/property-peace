/**
 * Platform-agnostic storage utility
 * Web: uses localStorage
 * Mobile: uses AsyncStorage (will be injected)
 */
class Storage {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async getItem(key) {
    return await this.adapter.getItem(key);
  }

  async setItem(key, value) {
    return await this.adapter.setItem(key, value);
  }

  async removeItem(key) {
    return await this.adapter.removeItem(key);
  }
}

export default Storage;
