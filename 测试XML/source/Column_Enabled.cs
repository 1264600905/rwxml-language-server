using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Verse;
using MusicManager;

namespace PMusicBlocker
{
    public class Column_Enabled : SongTableColumn
    {
        private static bool isDragging = false;
        private static bool dragTargetState = false;

        [StaticConstructorOnStartup]
        public static class PMB_Resources
        {
            public static readonly Texture2D Checked = ContentFinder<Texture2D>.Get("checked", true);
            public static readonly Texture2D Clear = ContentFinder<Texture2D>.Get("clear", true);
        }

        public override bool Filtered => false;

        public override string HeaderTooltip => "PMB_ColumnEnabledTooltip".Translate();

        public Column_Enabled(int width) : base(width)
        {
        }

        public override int Compare(SongDef a, SongDef b)
        {
            bool aDisabled = PMusicBlockerMod.settings.blockedSongs.Contains(a.defName);
            bool bDisabled = PMusicBlockerMod.settings.blockedSongs.Contains(b.defName);
            return aDisabled.CompareTo(bDisabled);
        }

        public override void DrawCell(Rect canvas, SongDef song)
        {
            base.DrawCell(canvas, song);
            bool isBlocked = PMusicBlockerMod.settings.blockedSongs.Contains(song.defName);
            bool enabled = !isBlocked;
            
            Rect rect = new Rect(canvas.x + 2f, canvas.y + 2f, 16f, 16f);
            
            // Draw the image
            GUI.DrawTexture(rect, enabled ? PMB_Resources.Checked : PMB_Resources.Clear);

            // Handle drag logic
            if (Mouse.IsOver(rect))
            {
                if (Event.current.type == EventType.MouseDown && Event.current.button == 0)
                {
                    isDragging = true;
                    dragTargetState = !enabled;
                    UpdateSongState(song, dragTargetState);
                    Event.current.Use();
                }
                else if (isDragging && enabled != dragTargetState)
                {
                    UpdateSongState(song, dragTargetState);
                }
            }

            // Global check to stop dragging
            if (isDragging && (Event.current.rawType == EventType.MouseUp || !Input.GetMouseButton(0)))
            {
                isDragging = false;
                PMusicBlockerMod.settings.Write(); // Save when done dragging
            }
        }

        private void UpdateSongState(SongDef song, bool targetEnabled)
        {
            if (PMusicBlockerMod.settings.blockedSongs == null)
                PMusicBlockerMod.settings.blockedSongs = new HashSet<string>();

            bool changed = false;
            if (targetEnabled)
            {
                if (PMusicBlockerMod.settings.blockedSongs.Contains(song.defName))
                {
                    PMusicBlockerMod.settings.blockedSongs.Remove(song.defName);
                    changed = true;
                }
            }
            else
            {
                if (!PMusicBlockerMod.settings.blockedSongs.Contains(song.defName))
                {
                    PMusicBlockerMod.settings.blockedSongs.Add(song.defName);
                    changed = true;
                }
            }

            if (changed)
            {
                // Sync with original mod if possible
                if (MusicManager.MusicManager.SongDatabase != null)
                {
                    MusicManager.MusicManager.SongDatabase[song].disabled = !targetEnabled;
                }

                Window_MusicManager.SetDirty();
                
                // If not dragging, write immediately. If dragging, we write on MouseUp.
                if (!isDragging)
                {
                    PMusicBlockerMod.settings.Write();
                }
            }
        }

        public override void DrawHeader(Rect canvas, List<SongDef> songs)
        {
            // Use an icon for the header. Play icon seems appropriate for "is enabled"
            Rect iconRect = new Rect(Vector2.zero, this.IconSize).CenteredIn(canvas);
            // Also move header icon slightly to align
            iconRect.x -= 2f;
            iconRect.y -= 2f;

            if (Widgets.ButtonImage(iconRect, MusicManager.Resources.Play, true))
            {
                 Window_MusicManager.SortBy = this;
            }
            this.DrawOverlay(canvas);
            TooltipHandler.TipRegion(canvas, () => this.HeaderTooltip, this.GetHashCode());
        }

        public override bool Filter(SongDef song)
        {
            return true;
        }
    }
}
