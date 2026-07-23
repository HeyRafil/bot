import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import prisma from '../database/prisma.js';
import logger from './logger.js';

const isProduction = fileURLToPath(import.meta.url).includes('dist');
const PLUGINS_DIR = isProduction
  ? path.resolve('./dist/plugins')
  : path.resolve('./src/plugins');

// Ensure plugins directory exists
if (!fs.existsSync(PLUGINS_DIR)) {
  fs.mkdirSync(PLUGINS_DIR, { recursive: true });
}

export interface PluginInterface {
  name: string;
  version: string;
  description?: string;
  onLoad?: (client: any) => void;
  onUnload?: (client: any) => void;
}

const activePlugins = new Map<string, PluginInterface>();

export const pluginManager = {
  /**
   * Loads all active plugins from the plugins directory
   */
  async loadPlugins(client: any): Promise<void> {
    logger.info("Initializing Plugin Manager...");
    activePlugins.clear();

    try {
      const files = fs.readdirSync(PLUGINS_DIR).filter(file => {
        if (isProduction) {
          return file.endsWith('.js');
        } else {
          return file.endsWith('.ts') || file.endsWith('.js');
        }
      });

      for (const file of files) {
        const filePath = path.join(PLUGINS_DIR, file);
        const name = path.parse(file).name;

        // Check if plugin is enabled in database
        const dbPlugin = await prisma.plugin.upsert({
          where: { name },
          update: {},
          create: {
            name,
            version: '1.0.0',
            description: `Auto-loaded plugin ${name}`,
            enabled: true
          }
        });

        if (!dbPlugin.enabled) {
          logger.info(`Plugin [${name}] is disabled in settings. Skipping.`);
          continue;
        }

        await this.loadPluginFile(filePath, client);
      }
    } catch (err: any) {
      logger.error("Failed to load plugins directory", err);
    }
  },

  /**
   * Dynamic loading of a single plugin file
   */
  async loadPluginFile(filePath: string, client: any): Promise<void> {
    const name = path.parse(filePath).name;
    const fileUrl = pathToFileURL(filePath).href;

    try {
      // Clear cache for reloadability (dynamic import cache busting using random hash query)
      const busText = `?bust=${Date.now()}`;
      const module = await import(fileUrl + busText);
      const plugin: PluginInterface = module.default || module;

      if (plugin && plugin.name) {
        if (typeof plugin.onLoad === 'function') {
          plugin.onLoad(client);
        }
        activePlugins.set(plugin.name.toLowerCase(), plugin);
        logger.info(`Successfully loaded plugin: [${plugin.name}] v${plugin.version}`);
      } else {
        logger.warn(`Invalid plugin signature in file: ${path.basename(filePath)}`);
      }
    } catch (err: any) {
      logger.error(`Failed to load plugin from ${path.basename(filePath)}`, err);
    }
  },

  /**
   * Reloads a plugin
   */
  async reloadPlugin(name: string, client: any): Promise<boolean> {
    const pluginKey = name.toLowerCase();
    const plugin = activePlugins.get(pluginKey);

    if (plugin) {
      if (typeof plugin.onUnload === 'function') {
        try { plugin.onUnload(client); } catch (_) {}
      }
      activePlugins.delete(pluginKey);
    }

    // Scan file path
    const jsPath = path.join(PLUGINS_DIR, `${name}.js`);
    const tsPath = path.join(PLUGINS_DIR, `${name}.ts`);
    const filePath = fs.existsSync(tsPath) ? tsPath : (fs.existsSync(jsPath) ? jsPath : null);

    if (!filePath) {
      logger.warn(`Plugin files for ${name} not found.`);
      return false;
    }

    await this.loadPluginFile(filePath, client);
    return true;
  },

  /**
   * Disables a plugin
   */
  async disablePlugin(name: string, client: any): Promise<void> {
    const pluginKey = name.toLowerCase();
    const plugin = activePlugins.get(pluginKey);

    if (plugin) {
      if (typeof plugin.onUnload === 'function') {
        try { plugin.onUnload(client); } catch (_) {}
      }
      activePlugins.delete(pluginKey);
    }

    await prisma.plugin.update({
      where: { name },
      data: { enabled: false }
    });
    logger.info(`Disabled plugin: [${name}]`);
  },

  /**
   * Enables a plugin
   */
  async enablePlugin(name: string, client: any): Promise<boolean> {
    await prisma.plugin.update({
      where: { name },
      data: { enabled: true }
    });

    const jsPath = path.join(PLUGINS_DIR, `${name}.js`);
    const tsPath = path.join(PLUGINS_DIR, `${name}.ts`);
    const filePath = fs.existsSync(tsPath) ? tsPath : (fs.existsSync(jsPath) ? jsPath : null);

    if (filePath) {
      await this.loadPluginFile(filePath, client);
      return true;
    }
    return false;
  },

  /**
   * Deletes a plugin
   */
  async deletePlugin(name: string, client: any): Promise<boolean> {
    const pluginKey = name.toLowerCase();
    const plugin = activePlugins.get(pluginKey);

    if (plugin) {
      if (typeof plugin.onUnload === 'function') {
        try { plugin.onUnload(client); } catch (_) {}
      }
      activePlugins.delete(pluginKey);
    }

    try {
      await prisma.plugin.delete({ where: { name } }).catch(() => {});
      
      const jsPath = path.join(PLUGINS_DIR, `${name}.js`);
      const tsPath = path.join(PLUGINS_DIR, `${name}.ts`);
      
      if (fs.existsSync(tsPath)) fs.unlinkSync(tsPath);
      if (fs.existsSync(jsPath)) fs.unlinkSync(jsPath);
      
      logger.info(`Deleted plugin: [${name}]`);
      return true;
    } catch (err: any) {
      logger.error(`Failed to delete plugin ${name}`, err);
      return false;
    }
  }
};

export default pluginManager;
