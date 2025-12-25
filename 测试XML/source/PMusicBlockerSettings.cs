using System.Collections.Generic;
using Verse;

namespace PMusicBlocker
{
    public class PMusicBlockerSettings : ModSettings
    {
        // Internal list for Scribe serialization
        private List<string> blockedSongsList = new List<string>();
        
        // Runtime HashSet for performance
        public HashSet<string> blockedSongs = new HashSet<string>();

        public override void ExposeData()
        {
            base.ExposeData();
            
            if (Scribe.mode == LoadSaveMode.Saving)
            {
                blockedSongsList = new List<string>(blockedSongs);
            }
            
            Scribe_Collections.Look(ref blockedSongsList, "blockedSongs", LookMode.Value);
            
            if (Scribe.mode == LoadSaveMode.PostLoadInit)
            {
                if (blockedSongsList != null)
                {
                    blockedSongs = new HashSet<string>(blockedSongsList);
                }
                else
                {
                    blockedSongs = new HashSet<string>();
                    blockedSongsList = new List<string>();
                }
            }
        }

        public void Reset()
        {
            blockedSongs.Clear();
            blockedSongsList.Clear();
        }
    }
}
