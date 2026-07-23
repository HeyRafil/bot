import logger from '../utils/logger.js';

export const helloPlugin = {
  name: 'HelloPlugin',
  version: '1.0.0',
  description: 'Contoh plugin sederhana untuk menyapa sistem saat bot dinyalakan.',
  onLoad(client: any) {
    logger.info("👋 HelloPlugin berhasil dimuat di WhatsApp Client!");
  },
  onUnload(client: any) {
    logger.info("👋 HelloPlugin berhasil dibongkar!");
  }
};

export default helloPlugin;
