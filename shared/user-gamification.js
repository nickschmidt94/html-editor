// User-Based Gamification System (Supabase Integration)
class UserGamification {
    constructor() {
        this.localStorageKey = 'html-editor-gamification';
        this.data = this.getDefaultData();
        this.isAuthenticated = false;
        this.userId = null;
        this.supabase = null;
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
        // Wait for Supabase to be available
        if (typeof window !== 'undefined') {
            await this.waitForSupabase();
            await this.initializeAuth();
        }
        
        // Load data (from Supabase if authenticated, localStorage if not)
        await this.loadUserData();
        
        this.checkDailyVisit();
        this.renderUI();
        this.setupEventListeners();
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (window.supabase && window.supabase.createClient) {
                    this.supabase = window.supabase.createClient(
                        'your-supabase-url', // Replace with actual URL
                        'your-supabase-key'  // Replace with actual key
                    );
                    resolve();
                } else if (window.documentStorage && window.documentStorage.supabase) {
                    this.supabase = window.documentStorage.supabase;
                    resolve();
                } else {
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }

    async initializeAuth() {
        if (!this.supabase) return;

        try {
            // Get current session
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session?.user) {
                this.isAuthenticated = true;
                this.userId = session.user.id;
                console.log('🎮 User authenticated for gamification:', session.user.email);
            }

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                const wasAuthenticated = this.isAuthenticated;
                
                if (session?.user) {
                    this.isAuthenticated = true;
                    this.userId = session.user.id;
                    
                    // If user just signed in, migrate local data
                    if (!wasAuthenticated) {
                        this.migrateLocalDataToUser();
                    }
                } else {
                    this.isAuthenticated = false;
                    this.userId = null;
                    // Fall back to localStorage
                    this.loadLocalData();
                }
                
                this.renderUI();
            });
        } catch (error) {
            console.warn('Auth initialization failed:', error);
            this.isAuthenticated = false;
        }
    }

    async loadUserData() {
        if (this.isAuthenticated && this.userId) {
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
                // First time user - create record
                await this.createUserRecord();
            }
        } catch (error) {
            console.warn('Failed to load from Supabase, using localStorage:', error);
            this.loadLocalData();
        }
    }

    async createUserRecord() {
        if (!this.supabase || !this.userId) return;

        try {
            const { error } = await this.supabase
                .from('user_gamification_stats')
                .insert({
                    user_id: this.userId,
                    current_streak: this.data.streak,
                    longest_streak: this.data.longestStreak,
                    last_activity_date: this.data.lastVisit,
                    total_xp: this.data.xp,
                    level: this.data.level,
                    documents_created: this.data.documentsCreated,
                    achievements: this.data.achievements
                });

            if (error) throw error;
            console.log('✅ Created user gamification record');
        } catch (error) {
            console.error('Failed to create user record:', error);
        }
    }

    loadLocalData() {
        const stored = localStorage.getItem(this.localStorageKey);
        if (stored) {
            this.data = { ...this.getDefaultData(), ...JSON.parse(stored) };
        }
        console.log('📱 Using localStorage for gamification data');
    }

    async saveData() {
        if (this.isAuthenticated && this.userId) {
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

    async migrateLocalDataToUser() {
        console.log('🔄 Migrating local data to user account...');
        
        // Load any existing local data
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

    // Rest of the methods remain the same as SimpleGamification
    checkDailyVisit() {
        const today = new Date().toDateString();
        const lastVisit = this.data.lastVisit;

        if (lastVisit !== today) {
            if (lastVisit) {
                const lastDate = new Date(lastVisit);
                const todayDate = new Date(today);
                const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

                if (daysDiff === 1) {
                    this.data.streak++;
                    this.addXP(5, 'Daily login');
                    
                    if (this.data.streak > this.data.longestStreak) {
                        this.data.longestStreak = this.data.streak;
                    }
                } else if (daysDiff > 1) {
                    this.data.streak = 1;
                    this.addXP(5, 'Daily login');
                }
            } else {
                this.data.streak = 1;
                this.addXP(5, 'Daily login');
            }

            this.data.lastVisit = today;
            this.saveData();
            this.checkAchievements();
        }
    }

    addXP(amount, reason = '') {
        this.data.xp += amount;
        
        const newLevel = Math.floor(this.data.xp / 100) + 1;
        if (newLevel > this.data.level) {
            this.data.level = newLevel;
            this.showNotification(`🎉 Level Up! You're now level ${newLevel}!`, 'success');
        }

        if (reason) {
            this.showXPGain(amount, reason);
        }

        this.saveData();
        this.renderXPBar();
    }

    onDocumentSaved() {
        this.data.documentsCreated++;
        this.addXP(10, 'Document saved');
        this.saveData();
        this.checkAchievements();
    }

    // UI methods remain the same...
    renderUI() {
        this.renderStreakCounter();
        this.renderXPBar();
        this.renderUserIndicator();
    }

    renderUserIndicator() {
        // Add small indicator showing data source
        const header = document.querySelector('header .header-nav');
        if (!header) return;

        let indicator = header.querySelector('.data-source-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'data-source-indicator';
            
            const authSection = header.querySelector('.auth-section');
            if (authSection) {
                header.insertBefore(indicator, authSection);
            }
        }

        indicator.innerHTML = this.isAuthenticated 
            ? '<span title="Progress synced to account">☁️</span>'
            : '<span title="Progress stored locally">📱</span>';
    }

    // Include all other methods from SimpleGamification...
    // (renderStreakCounter, renderXPBar, checkAchievements, etc.)
}

// Replace the simple version
document.addEventListener('DOMContentLoaded', () => {
    window.gamification = new UserGamification();
});