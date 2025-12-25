using HarmonyLib;
using RimWorld;
using MusicManager;
using Verse;

namespace PMusicBlocker
{
    [HarmonyPatch(typeof(MusicManagerPlay), "AppropriateNow")]
    public static class Patch_MusicManagerPlay_AppropriateNow
    {
        public static void Postfix(SongDef song, ref bool __result)
        {
            // If the song is already inappropriate, do nothing
            if (!__result)
            {
                return;
            }

            // Check our persistent settings first
            if (PMusicBlockerMod.settings.blockedSongs.Contains(song.defName))
            {
                __result = false;
                return;
            }

            // Check original database as fallback/sync
            if (MusicManager.MusicManager.SongDatabase != null)
            {
                SongMetaData meta = MusicManager.MusicManager.SongDatabase[song];
                if (meta != null && meta.disabled)
                {
                    __result = false;
                }
            }
        }
    }
}
