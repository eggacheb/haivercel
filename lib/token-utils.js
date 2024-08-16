import fs from 'fs/promises';
import config from './config.ts';
import { refreshToken } from '../api/controllers/token-utils.ts';
import logger from './logger.ts';
import sessionManager from './session-manager.ts';

interface RefreshStatus {
    timestamp: string;
    successCount: number;
    failCount: number;
}

class TokenManager {
    private tokens: string[] = [];
    private lastRefreshStatus: RefreshStatus | null = null;

    constructor() {
        this.initialize();
    }

    private async initialize() {
        await this.loadTokens();
        await this.refreshTokens(); // 立即执行一次刷新
        this.scheduleRefresh();
    }

    private async loadTokens() {
        try {
            const data = await fs.readFile(config.tokenSavePath, 'utf-8');
            this.tokens = JSON.parse(data);
            if (this.tokens.length === 0) {
                logger.warn('tokens.json is empty. Using default tokens.');
                this.tokens = [...config.tokens];
                await this.saveTokens();
            }
            logger.info(`Tokens loaded successfully. Total tokens: ${this.tokens.length}`);
        } catch (error) {
            logger.warn(`Failed to load saved tokens: ${error.message}. Using default tokens.`);
            this.tokens = [...config.tokens];
            await this.saveTokens();
            logger.info(`Default tokens loaded and saved. Total tokens: ${this.tokens.length}`);
        }
    }

    private async saveTokens() {
        try {
            await fs.writeFile(config.tokenSavePath, JSON.stringify(this.tokens, null, 2));
            logger.info(`Tokens saved successfully. Total tokens: ${this.tokens.length}`);
        } catch (error) {
            logger.error(`Failed to save tokens: ${error.message}`);
        }
    }

    getAllTokens(): string {
        return this.tokens.join(',');
    }

    getRefreshStatus(): RefreshStatus | null {
        return this.lastRefreshStatus;
    }

    async refreshTokens() {
        logger.info(`Starting token refresh. Total tokens to refresh: ${this.tokens.length}`);
        let successCount = 0;
        let failCount = 0;

        const newTokens = [];

        for (let i = 0; i < this.tokens.length; i++) {
            try {
                const newToken = await refreshToken(this.tokens[i]);
                if (newToken) {
                    newTokens.push(newToken);
                    logger.info(`Token ${i + 1} refreshed successfully`);
                    successCount++;
                } else {
                    logger.warn(`Token ${i + 1} refresh failed, keeping old token`);
                    newTokens.push(this.tokens[i]);
                    failCount++;
                }
            } catch (error) {
                logger.error(`Failed to refresh token ${i + 1}: ${error.message}`);
                newTokens.push(this.tokens[i]);
                failCount++;
            }
        }

        this.tokens = newTokens;
        await this.saveTokens();
        sessionManager.updateSessionTokens();

        this.lastRefreshStatus = {
            timestamp: new Date().toISOString(),
            successCount,
            failCount
        };

        logger.info(`Token refresh completed. Success: ${successCount}, Failed: ${failCount}, Total tokens: ${this.tokens.length}`);
    }

    async addToken(newToken: string) {
        if (!this.tokens.includes(newToken)) {
            this.tokens.push(newToken);
            await this.saveTokens();
            sessionManager.updateSessionTokens();
            logger.info(`New token added and tokens reloaded`);
        } else {
            logger.warn(`Token already exists, not adding duplicate`);
        }
    }

    async updateToken(oldToken: string, newToken: string) {
        const index = this.tokens.indexOf(oldToken);
        if (index !== -1) {
            this.tokens[index] = newToken;
            await this.saveTokens();
            sessionManager.updateSessionTokens();
            logger.info(`Token updated successfully`);
        } else {
            logger.warn(`Old token not found, adding new token instead`);
            await this.addToken(newToken);
        }
    }

    getRandomToken(): string {
        if (this.tokens.length === 0) {
            throw new Error("No tokens available");
        }
        return this.tokens[Math.floor(Math.random() * this.tokens.length)];
    }

    getTokenCount(): number {
        return this.tokens.length;
    }

    private scheduleRefresh() {
        setInterval(() => {
            this.refreshTokens();
        }, config.tokenRefreshInterval);
    }
}

export default new TokenManager();
