-- =====================================================
-- DATABASE: escape_game
-- =====================================================
CREATE DATABASE IF NOT EXISTS escape_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE escape_game;

-- =====================================================
-- TABLE: theme
-- =====================================================
CREATE TABLE theme (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- =====================================================
-- TABLE: game
-- =====================================================
CREATE TABLE game (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    score INT DEFAULT 0,
    current_level INT DEFAULT 0,
    time_left INT DEFAULT 0,
    is_finished BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- TABLE: player
-- =====================================================
CREATE TABLE player (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    token VARCHAR(255) UNIQUE,
    token_expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE: level
-- =====================================================
CREATE TABLE level (
    id INT AUTO_INCREMENT PRIMARY KEY,
    theme_id INT NOT NULL,
    required_score INT DEFAULT 0,
    FOREIGN KEY (theme_id) REFERENCES theme(id) ON DELETE CASCADE
);

-- =====================================================
-- TABLE: game_level (relation Game <-> Level)
-- =====================================================
CREATE TABLE game_level (
    game_id INT NOT NULL,
    level_id INT NOT NULL,
    is_finished BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (game_id, level_id),
    FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE,
    FOREIGN KEY (level_id) REFERENCES level(id) ON DELETE CASCADE
);

-- =====================================================
-- TABLE: player_game (NOUVELLE table de liaison Player <-> Game)
-- =====================================================
CREATE TABLE player_game (
    player_id INT NOT NULL,
    game_id INT NOT NULL,
    is_ready BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, game_id),
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE
);

-- =====================================================
-- TABLE: question
-- =====================================================
CREATE TABLE question (
    id INT AUTO_INCREMENT PRIMARY KEY,
    level_id INT NOT NULL,
    text TEXT NOT NULL,
    options JSON NOT NULL,
    correct_index INT NOT NULL,
    points INT DEFAULT 1,
    FOREIGN KEY (level_id) REFERENCES level(id) ON DELETE CASCADE
);

-- =====================================================
-- TABLE: player_answers (historique des réponses)
-- =====================================================
CREATE TABLE player_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_index INT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    points_earned INT DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE
);

-- =====================================================
-- INSERT
-- =====================================================

INSERT INTO theme (name) VALUES
('Air'),
('Energy'),
('Water');