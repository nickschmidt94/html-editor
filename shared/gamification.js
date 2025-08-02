// User-Based Gamification System with Supabase Integration
class UserGamification {
    constructor() {
        this.localStorageKey = 'html-editor-gamification';
        this.data = this.getDefaultData();
        this.isAuthenticated = false;
        this.userId = null;
        this.supabase = null;
        this.isReady = false;
        this.achievements = [];
        this.init();
    }

    getDefaultData() {
        return {
            streak: 0,
            longestStreak: 0,
            lastVisit: null,
            xp: 0,
            level: 1,
            documentsCreated: 0,
            achievements: []
        };
    }

    async init() {
        try {
            // Wait for dependencies
            await this.waitForDependencies();
            
            // Initialize Supabase connection
            await this.initializeSupabase();
            
            // Initialize authentication
            await this.initializeAuth();
            
            // Load user data
            await this.loadUserData();
            
            // Load achievements definitions
            await this.loadAchievements();
            
            // Check daily visit
            this.checkDailyVisit();
            
            // Render UI
            this.renderUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isReady = true;
            console.log('🎮 Gamification system ready!');
            
        } catch (error) {
            console.warn('Gamification initialization failed, using fallback mode:', error);
            this.fallbackToLocalMode();
        }
    }

    async waitForDependencies() {
        return new Promise((resolve) => {
            const checkDependencies = () => {
                if (window.documentStorage) {
                    resolve();
                } else {
                    setTimeout(checkDependencies, 100);
                }
            };
            checkDependencies();
        });
    }

    async initializeSupabase() {
        // Try to get Supabase from documentStorage first
        if (window.documentStorage && window.documentStorage.supabase) {
            this.supabase = window.documentStorage.supabase;
            console.log('✅ Using existing Supabase connection');
            return;
        }

        // Wait for Supabase to be available
        await new Promise((resolve) => {
            const checkSupabase = () => {
                if (window.supabaseLoaded && window.supabase && window.supabase.createClient) {
                    // Create Supabase client - these should be your actual values
                    // For now, we'll use the existing connection from documentStorage
                    if (window.documentStorage && window.documentStorage.supabase) {
                        this.supabase = window.documentStorage.supabase;
                    }
                    resolve();
                } else {
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }

    async initializeAuth() {
        if (!this.supabase) {
            console.warn('No Supabase connection, using local mode');
            return;
        }

        try {
            // Get current session
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session?.user) {
                this.isAuthenticated = true;
                this.userId = session.user.id;
                console.log('🎮 User authenticated for gamification:', session.user.email);
            }

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange(async (event, session) => {
                const wasAuthenticated = this.isAuthenticated;
                
                if (session?.user) {
                    this.isAuthenticated = true;
                    this.userId = session.user.id;
                    
                    // If user just signed in, migrate local data
                    if (!wasAuthenticated) {
                        await this.migrateLocalDataToUser();
                        await this.loadUserData();
                        this.renderUI();
                    }
                } else {
                    this.isAuthenticated = false;
                    this.userId = null;
                    // Fall back to localStorage
                    this.loadLocalData();
                    this.renderUI();
                }
            });
        } catch (error) {
            console.warn('Auth initialization failed:', error);
            this.isAuthenticated = false;
        }
    }

    async loadUserData() {
        if (this.isAuthenticated && this.userId && this.supabase) {
            await this.loadDataFromSupabase();
        } else {
            this.loadLocalData();
        }
    }

    async loadDataFromSupabase() {
        if (!this.supabase || !this.userId) {
            this.loadLocalData();
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('user_gamification_stats')
                .select('*')
                .eq('user_id', this.userId)
                .single();

            if (error && error.code !== 'PGRST116') { // Not found is OK
                throw error;
            }

            if (data) {
                this.data = {
                    streak: data.current_streak || 0,
                    longestStreak: data.longest_streak || 0,
                    lastVisit: data.last_activity_date,
                    xp: data.total_xp || 0,
                    level: data.level || 1,
                    documentsCreated: data.documents_created || 0,
                    achievements: data.achievements || []
                };
                console.log('✅ Loaded user gamification data from Supabase');
            } else {
                // First time user - will create record on first save
                console.log('📝 New user, will create gamification record');
            }
        } catch (error) {
            console.warn('Failed to load from Supabase, using localStorage:', error);
            this.loadLocalData();
        }
    }

    loadLocalData() {
        const stored = localStorage.getItem(this.localStorageKey);
        if (stored) {
            this.data = { ...this.getDefaultData(), ...JSON.parse(stored) };
        }
        console.log('📱 Using localStorage for gamification data');
    }

    async loadAchievements() {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase
                .from('achievements')
                .select('*')
                .eq('is_active', true)
                .order('requirement_value');

            if (error) throw error;

            this.achievements = data || [];
            console.log(`✅ Loaded ${this.achievements.length} achievements`);
        } catch (error) {
            console.warn('Failed to load achievements:', error);
            // Use fallback achievements
            this.achievements = this.getFallbackAchievements();
        }
    }

    getFallbackAchievements() {
        return [
            {
                id: 'first_document',
                name: 'First Steps',
                description: 'Created your first document',
                icon: '👶',
                category: 'coding',
                requirement_type: 'documents_created',
                requirement_value: 1,
                xp_reward: 50
            },
            {
                id: 'streak_3',
                name: 'Getting Warmed Up',
                description: '3-day coding streak',
                icon: '🔥',
                category: 'streak',
                requirement_type: 'streak_days',
                requirement_value: 3,
                xp_reward: 100
            },
            {
                id: 'streak_7',
                name: 'On Fire!',
                description: '7-day coding streak',
                icon: '🚀',
                category: 'streak',
                requirement_type: 'streak_days',
                requirement_value: 7,
                xp_reward: 250
            },
            {
                id: 'documents_10',
                name: 'Productive Coder',
                description: 'Created 10 documents',
                icon: '💻',
                category: 'coding',
                requirement_type: 'documents_created',
                requirement_value: 10,
                xp_reward: 200
            },
            {
                id: 'xp_100',
                name: 'Experience Gained',
                description: 'Earned 100 XP',
                icon: '⭐',
                category: 'learning',
                requirement_type: 'xp_total',
                requirement_value: 100,
                xp_reward: 50
            }
        ];
    }

    async saveData() {
        if (this.isAuthenticated && this.userId && this.supabase) {
            await this.saveToSupabase();
        } else {
            this.saveToLocalStorage();
        }
    }

    async saveToSupabase() {
        if (!this.supabase || !this.userId) {
            this.saveToLocalStorage();
            return;
        }

        try {
            const { error } = await this.supabase
                .from('user_gamification_stats')
                .upsert({
                    user_id: this.userId,
                    current_streak: this.data.streak,
                    longest_streak: this.data.longestStreak,
                    last_activity_date: this.data.lastVisit,
                    total_xp: this.data.xp,
                    level: this.data.level,
                    documents_created: this.data.documentsCreated,
                    achievements: this.data.achievements,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            
            // Also save to localStorage as backup
            this.saveToLocalStorage();
            
        } catch (error) {
            console.error('Failed to save to Supabase:', error);
            this.saveToLocalStorage();
        }
    }

    saveToLocalStorage() {
        localStorage.setItem(this.localStorageKey, JSON.stringify(this.data));
    }

    async logXPActivity(activityType, xpEarned, description = '') {
        if (!this.supabase || !this.userId) return;

        try {
            await this.supabase
                .from('xp_activities')
                .insert({
                    user_id: this.userId,
                    activity_type: activityType,
                    xp_earned: xpEarned,
                    description: description
                });
        } catch (error) {
            console.warn('Failed to log XP activity:', error);
        }
    }

    async migrateLocalDataToUser() {
        console.log('🔄 Migrating local data to user account...');
        
        const localData = localStorage.getItem(this.localStorageKey);
        if (localData) {
            const parsed = JSON.parse(localData);
            
            // Only migrate if local data is more advanced
            if (parsed.xp > this.data.xp || parsed.documentsCreated > this.data.documentsCreated) {
                this.data = { ...this.getDefaultData(), ...parsed };
                await this.saveToSupabase();
                
                this.showNotification('🎉 Progress migrated to your account!', 'success');
            }
        }
    }

    fallbackToLocalMode() {
        this.loadLocalData();
        this.achievements = this.getFallbackAchievements();
        this.renderUI();
        this.setupEventListeners();
        this.isReady = true;
        console.log('📱 Running in local storage mode');
    }

    checkDailyVisit() {
        const today = new Date().toDateString();
        const lastVisit = this.data.lastVisit;

        if (lastVisit !== today) {
            if (lastVisit) {
                const lastDate = new Date(lastVisit);
                const todayDate = new Date(today);
                const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

                if (daysDiff === 1) {
                    // Consecutive day - increase streak
                    this.data.streak++;
                    this.addXP(5, 'Daily login');
                    
                    if (this.data.streak > this.data.longestStreak) {
                        this.data.longestStreak = this.data.streak;
                    }
                } else if (daysDiff > 1) {
                    // Streak broken
                    this.data.streak = 1;
                    this.addXP(5, 'Daily login');
                }
            } else {
                // First visit
                this.data.streak = 1;
                this.addXP(5, 'Daily login');
            }

            this.data.lastVisit = today;
            this.saveData();
            this.checkAchievements();
        }
    }

    async addXP(amount, reason = '') {
        this.data.xp += amount;
        
        // Calculate level (every 100 XP = new level)
        const newLevel = Math.floor(this.data.xp / 100) + 1;
        if (newLevel > this.data.level) {
            this.data.level = newLevel;
            this.showNotification(`🎉 Level Up! You're now level ${newLevel}!`, 'success');
        }

        if (reason) {
            this.showXPGain(amount, reason);
        }

        await this.saveData();
        
        // Log XP activity
        await this.logXPActivity(this.getActivityTypeFromReason(reason), amount, reason);
        
        this.renderXPBar();
    }

    getActivityTypeFromReason(reason) {
        if (reason.includes('Daily login')) return 'daily_login';
        if (reason.includes('Document saved')) return 'document_saved';
        if (reason.includes('Level up')) return 'level_up';
        return 'other';
    }

    onDocumentSaved() {
        this.data.documentsCreated++;
        this.addXP(10, 'Document saved');
        this.saveData();
        this.checkAchievements();
    }

    checkAchievements() {
        this.achievements.forEach(achievement => {
            if (!this.data.achievements.includes(achievement.id) && this.isAchievementUnlocked(achievement)) {
                this.unlockAchievement(achievement);
            }
        });
    }

    isAchievementUnlocked(achievement) {
        switch (achievement.requirement_type) {
            case 'documents_created':
                return this.data.documentsCreated >= achievement.requirement_value;
            case 'streak_days':
                return this.data.streak >= achievement.requirement_value;
            case 'xp_total':
                return this.data.xp >= achievement.requirement_value;
            case 'level':
                return this.data.level >= achievement.requirement_value;
            default:
                return false;
        }
    }

    async unlockAchievement(achievement) {
        this.data.achievements.push(achievement.id);
        
        // Award XP for achievement
        if (achievement.xp_reward > 0) {
            this.data.xp += achievement.xp_reward;
            
            // Check for level up
            const newLevel = Math.floor(this.data.xp / 100) + 1;
            if (newLevel > this.data.level) {
                this.data.level = newLevel;
                this.showNotification(`🎉 Level Up! You're now level ${newLevel}!`, 'success');
            }
        }
        
        await this.saveData();
        
        // Log XP activity
        await this.logXPActivity('achievement_unlocked', achievement.xp_reward, `Unlocked: ${achievement.name}`);
        
        this.showAchievementUnlocked(achievement);
        this.renderXPBar();
    }

    renderUI() {
        this.renderStreakCounter();
        this.renderXPBar();
        this.renderUserIndicator();
    }

    renderUserIndicator() {
        const header = document.querySelector('header .header-nav');
        if (!header) return;

        let indicator = header.querySelector('.data-source-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'data-source-indicator';
            indicator.style.cssText = `
                display: flex;
                align-items: center;
                margin-right: 8px;
                font-size: 12px;
                opacity: 0.7;
                cursor: help;
            `;
            
            const authSection = header.querySelector('.auth-section');
            if (authSection) {
                header.insertBefore(indicator, authSection);
            } else {
                header.appendChild(indicator);
            }
        }

        const isConnected = this.isAuthenticated && this.supabase;
        indicator.innerHTML = isConnected 
            ? '<span title="Progress synced to your account across devices">☁️</span>'
            : '<span title="Progress stored locally on this device">📱</span>';
    }

    renderStreakCounter() {
        const header = document.querySelector('header .header-nav');
        if (!header) return;

        const streakWidget = document.createElement('div');
        streakWidget.className = 'streak-widget';
        streakWidget.innerHTML = `
            <div class="streak-flame ${this.data.streak > 0 ? 'active' : ''}">
                <span class="flame-icon">🔥</span>
                <span class="streak-count">${this.data.streak}</span>
            </div>
            <div class="streak-tooltip">
                <div>Current: ${this.data.streak} days</div>
                <div>Best: ${this.data.longestStreak} days</div>
            </div>
        `;

        // Insert before auth section
        const authSection = header.querySelector('.auth-section');
        if (authSection) {
            header.insertBefore(streakWidget, authSection);
        } else {
            header.appendChild(streakWidget);
        }
    }

    renderXPBar() {
        const header = document.querySelector('header .header-nav');
        if (!header) return;

        let xpBar = header.querySelector('.xp-bar');
        if (!xpBar) {
            xpBar = document.createElement('div');
            xpBar.className = 'xp-bar';
            
            const authSection = header.querySelector('.auth-section');
            if (authSection) {
                header.insertBefore(xpBar, authSection);
            } else {
                header.appendChild(xpBar);
            }
        }

        const currentLevelXP = (this.data.level - 1) * 100;
        const nextLevelXP = this.data.level * 100;
        const progress = ((this.data.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

        xpBar.innerHTML = `
            <div class="level-badge">LV ${this.data.level}</div>
            <div class="xp-progress">
                <div class="xp-fill" style="width: ${progress}%"></div>
                <span class="xp-text">${this.data.xp} XP</span>
            </div>
        `;
    }

    setupEventListeners() {
        // Hook into existing save functionality
        const originalSaveDocument = window.documentStorage?.saveDocument;
        if (originalSaveDocument) {
            window.documentStorage.saveDocument = (...args) => {
                const result = originalSaveDocument.apply(window.documentStorage, args);
                this.onDocumentSaved();
                return result;
            };
        }
    }

    showXPGain(amount, reason) {
        const notification = document.createElement('div');
        notification.className = 'xp-notification';
        notification.innerHTML = `
            <span class="xp-amount">+${amount} XP</span>
            <span class="xp-reason">${reason}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showAchievementUnlocked(achievement) {
        const modal = document.createElement('div');
        modal.className = 'achievement-modal';
        modal.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-header">
                    <h2>🎉 Achievement Unlocked!</h2>
                </div>
                <div class="achievement-badge">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-info">
                        <h3>${achievement.name}</h3>
                        <p>${achievement.description}</p>
                    </div>
                </div>
                <button class="achievement-close" onclick="this.parentElement.parentElement.remove()">
                    Awesome!
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (modal.parentElement) {
                modal.remove();
            }
        }, 5000);
    }

    showNotification(message, type = 'info') {
        if (typeof showCopyNotification === 'function') {
            showCopyNotification(message, type);
        }
    }
}

// Initialize gamification when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.gamification = new UserGamification();
});