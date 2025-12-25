// ⚠️ TEMPLATE WARNING: This is a template project for RimWorld mod development
// 🔧 RENAME REQUIRED: Update all "TempProject" references to your mod name

using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

/*
🏗️ TEMPLATE: Assembly Information for RimWorld Mod
⚠️ IMPORTANT: Update all the values below for your mod!

💡 TIPS:
- AssemblyTitle: User-friendly name shown in error messages
- AssemblyDescription: Brief description of your mod
- AssemblyCompany: Your name or team name
- AssemblyCopyright: Your copyright information
- AssemblyVersion: Semantic version (Major.Minor.Patch.Build)
*/

// 🔧 TEMPLATE: CHANGE THESE VALUES to match your mod
[assembly: AssemblyTitle("TempProject")]                    // ⚠️ CHANGE: Your mod's display name
[assembly: AssemblyDescription("Template mod for RimWorld development")]  // ⚠️ CHANGE: Your mod's description
[assembly: AssemblyConfiguration("Debug")]                   // ✅ OKAY: Can keep or change
[assembly: AssemblyCompany("Mod Template Author")]          // ⚠️ CHANGE: Your name/team
[assembly: AssemblyProduct("TempProject")]                   // ⚠️ CHANGE: Your mod name
[assembly: AssemblyCopyright("Copyright © 2025")]           // ⚠️ CHANGE: Your copyright info
[assembly: AssemblyTrademark("")]                            // ⚠️ CHANGE: Your trademark (if any)
[assembly: AssemblyCulture("")]                             // ✅ OKAY: Keep empty for RimWorld

// 🔧 COM INTEROP: Keep as false for RimWorld mods
// RimWorld mods don't need to be visible to COM components
[assembly: ComVisible(false)]

// 🎯 GUID: IMPORTANT - Generate a new GUID for your mod!
// This GUID identifies your assembly. Use Visual Studio or online GUID generator.
// ⚠️ CRITICAL: Change this to a new unique GUID!
[assembly: Guid("439bce84-6b96-441e-9dc1-fcaf59d5f813")]

/*
📊 VERSIONING: Assembly version information
Format: Major.Minor.Patch.Build

💡 EXAMPLES:
- "1.0.0.0" - First release
- "1.1.0.0" - Feature update
- "1.1.1.0" - Bug fix
- "2.0.0.0" - Major update

🔧 TEMPLATE: Set your version appropriately
*/
[assembly: AssemblyVersion("1.0.0.0")]    // ⚠️ CHANGE: Your mod's version
[assembly: AssemblyFileVersion("1.0.0.0")] // ⚠️ CHANGE: Your file version (usually same as above)

/*
📝 NOTES:
- AssemblyVersion: Used by .NET for binding and version checking
- AssemblyFileVersion: Windows file version (shown in file properties)
- Keep both versions in sync for simplicity
- Consider using semantic versioning: https://semver.org/
- RimWorld doesn't enforce strict versioning, but consistency helps users
*/

// 🎯 RIMWORLD SPECIFIC: These attributes are useful for debugging
[assembly: InternalsVisibleTo("TempProject.Test")]  // ⚠️ CHANGE: For unit tests (if you add them)
