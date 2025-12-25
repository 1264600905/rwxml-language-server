using UnityEngine;
using Verse;
using HarmonyLib;
using MusicManager;
using System.Linq;

namespace PMusicBlocker
{
    public class PMusicBlockerMod : Mod
    {
        public static PMusicBlockerSettings settings;

                public PMusicBlockerMod(ModContentPack content) : base(content)

                {

                    settings = GetSettings<PMusicBlockerSettings>();

                    var harmony = new Harmony("PMusicBlocker");

                    harmony.PatchAll();

                }

            }

        

            [StaticConstructorOnStartup]

            public static class PMusicBlocker_Initializer

            {

                static PMusicBlocker_Initializer()

                {

                    // Add the new column to MusicManager

                    if (!Window_MusicManager.Columns.Any(c => c is Column_Enabled))

                    {

                        Window_MusicManager.Columns.Add(new Column_Enabled(24));

                    }

        

                    // Sync our persistent settings to the original mod's database on startup

                    LongEventHandler.ExecuteWhenFinished(() =>

                    {

                        if (PMusicBlockerMod.settings == null)

                        {

                            return;

                        }

        

                        if (MusicManager.MusicManager.SongDatabase != null)

                        {

                            var songs = DefDatabase<SongDef>.AllDefsListForReading;

                            

                            foreach (var songDef in songs)

                            {

                                if (PMusicBlockerMod.settings.blockedSongs.Contains(songDef.defName))

                                {

                                    MusicManager.MusicManager.SongDatabase[songDef].disabled = true;

                                }

                            }

                        }

                    });

                }

            }

        }

        

    