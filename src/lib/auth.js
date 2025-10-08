import { goto } from '$app/navigation';

const PLAYER_STORAGE_KEY = 'escape_game_player';

export function savePlayer(player) {
  try {
    if (player && player.token) {
      localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
      console.log('💾 Joueur sauvegardé:', player.name);
      return true;
    }
  } catch (error) {
    console.error('❌ Erreur sauvegarde joueur:', error);
  }
  return false;
}

export function getStoredPlayer() {
  try {
    const playerData = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (playerData) {
      const player = JSON.parse(playerData);
      console.log('📂 Joueur trouvé en storage:', player.name);
      return player;
    }
  } catch (error) {
    console.error('❌ Erreur lecture storage:', error);
  }
  console.log('📭 Aucun joueur en storage');
  return null;
}

export function clearPlayer() {
  try {
    localStorage.removeItem(PLAYER_STORAGE_KEY);
    console.log('🧹 Joueur supprimé du storage');
  } catch (error) {
    console.error('❌ Erreur suppression storage:', error);
  }
}

export async function verifyToken(token) {
  try {
    console.log('🔐 Vérification token...');
    const response = await fetch(`/api/players/verify-token?token=${token}`);
    
    if (response.ok) {
      const player = await response.json();
      console.log('✅ Token valide pour:', player.name);
      return player;
    } else {
      console.log('❌ Token invalide');
    }
  } catch (error) {
    console.error('❌ Erreur vérification token:', error);
  }
  return null;
}

export async function restoreSession() {
  try {
    console.log('🔄 Début restauration session...');
    const storedPlayer = getStoredPlayer();
    
    if (storedPlayer && storedPlayer.token) {
      console.log('🔍 Token trouvé, vérification...');
      const validPlayer = await verifyToken(storedPlayer.token);
      
      if (validPlayer) {
        console.log('🎉 Session restaurée avec succès');
        return validPlayer;
      } else {
        console.log('🧹 Token invalide, nettoyage...');
        clearPlayer();
      }
    } else {
      console.log('👻 Aucune session à restaurer');
    }
  } catch (error) {
    console.error('💥 Erreur critique restauration:', error);
  }
  
  return null;
}