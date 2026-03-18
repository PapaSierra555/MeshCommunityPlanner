# Mesh Community Planner — User Guide

**Version:** 1.3.3
**Last Updated:** March 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Managing Plans](#managing-plans)
4. [Working with Nodes](#working-with-nodes)
5. [The Node Configuration Wizard](#the-node-configuration-wizard)
6. [Using the Map](#using-the-map)
7. [Propagation Analysis](#propagation-analysis)
8. [Line-of-Sight Analysis](#line-of-sight-analysis)
9. [Network Topology](#network-topology)
10. [Analysis Tools](#analysis-tools)
11. [Bill of Materials](#bill-of-materials)
12. [Import and Export](#import-and-export)
13. [Hardware Catalog](#hardware-catalog)
14. [Settings](#settings)
15. [Keyboard Shortcuts](#keyboard-shortcuts)
16. [Tips and Best Practices](#tips-and-best-practices)

---

## Introduction

Mesh Community Planner is a desktop application for planning LoRa mesh network deployments. It runs a local web server and opens in your browser — no accounts, no cloud, no internet required after initial setup. All your data stays on your machine.

### What You Can Do

- Place nodes on an interactive OpenStreetMap
- Configure each node with real hardware from a built-in device catalog
- Simulate RF coverage using terrain-aware propagation (Longley-Rice/ITWOM with SRTM 30m elevation data)
- Analyze line-of-sight between nodes with terrain profiles and Fresnel zone clearance
- View network topology and identify single points of failure
- Run advanced analysis: viewshed, LoRa airtime calculations, channel capacity estimation, message flooding simulation, and optimal node placement suggestions
- Generate a bill of materials with pricing, CSV/PDF export, and printable deployment cards
- Export plans in multiple formats: .meshplan JSON, CSV, KML, GeoJSON, and CoT/TAK XML

### System Requirements

- **OS:** Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+)
- **RAM:** 4 GB
- **Disk:** 500 MB for the application, plus up to 2 GB for cached map tiles and terrain data
- **Browser:** Chrome 100+, Firefox 98+, Safari 15+, Edge 100+
- **Internet:** Required for map tiles and terrain data on first use. After caching, the app works fully offline.

---

## Getting Started

### Launching the Application

- **Windows:** Start Menu → Mesh Community Planner, or run `MeshCommunityPlanner.exe`
- **macOS:** Applications → Mesh Community Planner
- **Linux:** Run the AppImage or use the desktop shortcut

The app starts a local server on port 8321 and opens your default browser to `http://127.0.0.1:8321`. If the browser doesn't open automatically, navigate to that address manually.

### First Launch

On first launch, 4 sample plans are loaded so you can explore the interface immediately:

- **(Sample) Colorado Terrain** — 4 nodes demonstrating how terrain affects coverage
- **(Sample) EU 868 Urban Mesh - Berlin** — 4 nodes with EU 868 MHz regulatory settings
- **(Sample) SF Bay Area Mixed Mesh** — 6 nodes across varied terrain (hills, water, urban)
- **(Sample) Suburban Neighborhood Mesh** — 3 nodes in a simple residential layout

Click any sample plan to open it and explore the features. These plans are read-only examples — you can duplicate them if you want to experiment with changes.

### Interface Overview

The main interface has four areas:

- **Toolbar** (top) — Menus for Plan, Plan Info, Tools, Catalog, and Help. This is where you access all major actions: creating plans, placing nodes, running analysis, importing/exporting, and managing the hardware catalog.
- **Map** (center) — Interactive OpenStreetMap with node markers, coverage overlays, and link visualizations. Click to place nodes, drag to move them, and use the mouse wheel to zoom.
- **Side Panel** (right) — Contextual panel showing node details, the configuration wizard, or analysis results when active.
- **Status Bar** (bottom) — Shows current map coordinates, zoom level, selected node count, and analysis progress.

### Welcome Tour

On your very first launch, a guided tour walks you through the main features step by step. You can dismiss it at any time by clicking "Skip Tour." To replay the tour later, use the Help menu.

---

## Managing Plans

A plan is a complete mesh network design — it contains all your nodes, their configurations, and any analysis results.

### Creating a New Plan

1. Open the **Plan** menu in the toolbar
2. Click **New Plan**
3. Enter a plan name (e.g., "Downtown Network")
4. Select firmware: **Meshtastic**, **MeshCore**, or **Reticulum/RNode**
5. Select region: **US FCC**, **EU 868**, **EU 433**, or **ANZ**
6. Click **Create**

The map opens centered on the default location. Navigate to your deployment area by panning and zooming, or use the address search bar to jump to a specific location.

### Opening an Existing Plan

1. Open the **Plan** menu
2. Click **Open Plan**
3. Select a plan from the list of saved plans
4. The map loads with all the plan's nodes and any cached analysis results

### Plan Operations

- **Rename:** Click the plan name in the toolbar to edit it inline
- **Duplicate:** Plan menu → **Duplicate Plan** creates an exact copy with a new name
- **Close:** Plan menu → **Close Plan** unloads the plan from view but keeps it saved
- **Delete:** Plan menu → **Delete Plan** permanently removes the plan and all its nodes (confirmation required)

### Auto-Save

All changes are saved automatically to the local SQLite database as you work. There is no manual save button — every node placement, edit, and deletion is persisted immediately. To create a portable file you can share with others, use the Export feature.

### Plan Info Panel

Open the **Plan Info** menu in the toolbar to see a summary of all loaded plans:

- Total plans and total node count
- Per-plan details: name, node count, firmware, and region
- Network statistics: total nodes, LOS links, coverage overlays, radio configuration, and environment type

---

## Working with Nodes

Nodes are the devices in your mesh network. Each node represents a physical location where you plan to install a LoRa radio.

### Adding a Node

1. Click **Add Node** in the toolbar (or press `Insert`)
2. Your cursor changes to indicate placement mode
3. Click on the map where you want to place the node
4. The **Node Configuration Wizard** opens with the location pre-filled

When you add your first node, you choose the radio settings (firmware, region, frequency, modem preset). Subsequent nodes automatically inherit these network-wide settings to maintain consistency across your mesh.

After completing the wizard, the node appears on the map with an FSPL coverage circle showing its estimated range.

### Selecting Nodes

- **Single select:** Click a node marker on the map. It turns red to indicate selection.
- **Multi-select:** Hold `Ctrl` and click additional nodes. They turn orange. The last-clicked node is the primary selection (red).
- **Cycle through nodes:** Press `Tab` to select the next node, or `Shift+Tab` for the previous one.
- **Focus on a node:** Press `Enter` to center the map on the selected node.

### Editing a Node

1. Click a node marker on the map to select it
2. The node details panel opens on the right
3. Click **Edit** to reopen the Configuration Wizard
4. Make changes to any step and click **Done**

### Moving a Node

Drag the node marker to a new position on the map. The FSPL coverage circle updates automatically. If you have multiple nodes selected, dragging one moves the entire group.

### Deleting a Node

Select the node and click **Delete** in the details panel, or press the `Delete` key. A confirmation dialog appears for destructive actions.

### Bulk Import from CSV

For large deployments, you can import node locations from a spreadsheet:

1. Open the **Plan** menu
2. Click **Import Nodes (CSV)**
3. Select your CSV file
4. Review the column mapping (auto-detected)
5. Click **Import Nodes**

**Required CSV columns:** `name`, `latitude`, `longitude`

**Optional columns:** `antenna_height`, `device`, `frequency`, `tx_power`, `modem_preset`, `role`

Imported nodes inherit the plan's default radio settings for any fields not specified in the CSV.

### Node Templates

Templates let you save a complete node configuration (device, radio, antenna, power) and reuse it for multiple nodes:

1. Configure a node completely through the wizard
2. On the Save as Template step, check "Save this configuration as a template"
3. Give the template a name (e.g., "Standard Relay")
4. When adding new nodes, select the template to pre-fill all settings
5. Only change the name, location, and antenna height per site

Templates save significant time when deploying multiple nodes with identical hardware.

---

## The Node Configuration Wizard

The wizard guides you through configuring a node in 7 steps. A progress bar at the top shows your completion status, and breadcrumb navigation lets you jump back to any completed step.

### Step 1: Location

- **Latitude** — Pre-filled from your map click. Editable with 0.000001° precision.
- **Longitude** — Pre-filled from your map click. Editable with 0.000001° precision.
- **Node Name** — A descriptive name for this site (e.g., "Tower Hill", "Community Center Roof").

### Step 2: Device Configuration

- **Device ID** — Select a device from the hardware catalog or enter a custom device name.
- **Firmware Family** — The mesh firmware this device will run: Meshtastic, MeshCore, or Custom.

The catalog pre-fills device specs (frequency range, max TX power, receiver sensitivity, GPS, battery type) based on your selection.

### Step 3: Radio Configuration

- **TX Power (dBm)** — Transmit power output. Default: 20 dBm. Higher values increase range but consume more battery. Typical range: 14–20 dBm.
- **RX Sensitivity (dBm)** — How weak a signal the receiver can detect. Default: -120 dBm. Lower (more negative) values mean better weak-signal reception. Typical: -120 to -130 dBm.
- **Region Code** — Regulatory region that determines allowed frequency bands and maximum transmit power: US (FCC), EU (ETSI), ANZ, etc.

### Step 4: Antenna Configuration

- **Antenna Gain (dBi)** — How much the antenna focuses the signal. Default: 2 dBi. Omnidirectional antennas: 0–3 dBi. Directional antennas: 3–15+ dBi.
- **Antenna Height (m)** — Height above ground level. This is one of the most impactful settings for coverage. Even small increases (2m → 10m) can dramatically improve range by clearing terrain obstacles.
- **Cable Loss (dB)** — Signal lost in the coaxial cable between radio and antenna. Default: 0 dB. Typical: 0–3 dB for short runs. Use low-loss cable for long runs.
- **Environment** — The terrain around this node. Affects propagation calculations:
  - **LOS Elevated** — Clear line-of-sight from an elevated position (tower, hilltop)
  - **Open Rural** — Flat open terrain with minimal obstacles
  - **Suburban** — Residential area with houses and trees
  - **Urban** — Dense buildings and structures
  - **Indoor** — Inside a building

### Step 5: Advanced Options

- **Status** — The deployment stage of this node:
  - **Configured** — Planned but not yet installed
  - **Deployed** — Installed and operational
  - **Inactive** — Temporarily offline or decommissioned

### Step 6: Save as Template

- **Save this configuration as a template** — Check this box to save the current settings as a reusable template. You'll be prompted for a template name.
- Template saves everything except the location coordinates, so you can reuse the same hardware configuration at different sites.

### Step 7: Review

A read-only summary of all settings organized by section:

- **Location:** Latitude, Longitude, Name
- **Device:** Device ID, Firmware
- **Radio:** TX Power, RX Sensitivity, Region
- **Antenna:** Gain, Height, Cable Loss, Environment

Review the configuration and click **Finish** to save the node, or use the breadcrumb navigation to go back and change any step.

---

## Using the Map

### Navigation

- **Pan:** Click and drag the map, or use arrow keys
- **Zoom:** Mouse wheel, or `+` / `-` keys
- **Reset zoom:** `Ctrl+0`
- **Center on all nodes:** `Home` key

### Address Search

The search bar at the top of the map lets you find and navigate to any location:

1. Type an address, city name, or landmark
2. Autocomplete results appear as you type
3. Click a result (or use arrow keys and Enter) to center the map on that location
4. Click the clear button to reset the search

The search uses Nominatim (OpenStreetMap's geocoding service) — no API key required.

### Layer Controls

Toggle map overlays on and off to control what's visible:

- **Coverage Circles** — FSPL range circles around each node
- **Connectivity Lines** — LOS links between connected nodes
- **Heatmap** — Signal strength heat map from terrain propagation
- **Overlap Zones** — Areas where multiple nodes provide coverage
- **Planning Radius** — Desired coverage radius indicators
- **Node Labels** — Node names displayed on the map
- **Fresnel Zones** — First Fresnel zone visualization on links

### Coverage Legend

When terrain coverage overlays are active, a legend appears showing the signal strength color scale:

| Color | Signal Strength | Quality |
|-------|----------------|---------|
| Red | > -80 dBm | Strong |
| Orange | -80 to -90 dBm | Good |
| Yellow | -90 to -100 dBm | Fair |
| Green | -100 to -110 dBm | Weak |
| Cyan | -110 to -120 dBm | Marginal |
| Blue | -120 to -130 dBm | At receiver limit |

An opacity slider lets you adjust the transparency of the coverage overlay so you can see the underlying map.

### Clearing Overlays

To remove all analysis overlays (LOS links, coverage heatmaps, viewshed, route paths) from the map, use Tools menu → **Clear Overlays**.

---

## Propagation Analysis

Propagation analysis predicts how far your radio signals will travel, accounting for terrain, frequency, power, and antenna configuration.

### FSPL Preview (Instant)

When you place a node, a green circle immediately appears showing the estimated free-space path loss (FSPL) range. This calculation assumes flat terrain with no obstacles — it gives you a quick "best case" estimate.

FSPL circles are useful for initial planning but will overestimate coverage in hilly or obstructed terrain. For accurate predictions, run terrain-aware propagation.

### Terrain-Aware Coverage (Signal-Server)

For realistic coverage predictions that account for hills, valleys, and terrain features:

1. Open the **Tools** menu
2. Click **Coverage Analysis**
3. The analysis runs on all nodes, or only selected nodes if you have a selection

**What happens behind the scenes:**

1. The app checks if SRTM 30m elevation data is cached for your area
2. If not, it downloads the required terrain tiles from USGS (this happens automatically)
3. The Longley-Rice/ITWOM propagation model runs a radial sweep from each node (360 bearings by default)
4. At each bearing, the terrain profile is sampled and knife-edge diffraction is applied where terrain obstructs the path
5. Results are rendered as a colored heat map overlay on the map

**First-run timing:**
- Terrain download for a small area (~10 km): ~30 seconds
- Terrain download for a large area (~100 km): 2–5 minutes
- After caching, subsequent runs in the same area are much faster

**Reading the results:**

The coverage overlay replaces the simple FSPL circles with a terrain-aware heat map. Notice that coverage is no longer circular — it follows the terrain. Signals travel farther over flat ground and are blocked by hills and ridges.

**Adjusting coverage:**

If coverage is insufficient for your deployment:

- **Increase antenna height** — The single most effective change. Going from 2m to 10m can dramatically improve range.
- **Increase transmit power** — Within your region's regulatory limits (check the regulatory presets).
- **Use a higher-gain antenna** — A directional antenna focuses energy in one direction for longer point-to-point links.
- **Add relay nodes** — Place additional nodes on high ground to bridge coverage gaps.
- **Use the placement suggestion tool** — Let the app recommend optimal locations (see [Analysis Tools](#analysis-tools)).

---

## Line-of-Sight Analysis

Line-of-sight (LOS) analysis checks whether two nodes have a clear radio path by examining the terrain between them.

### Running LOS Analysis

1. Open the **Tools** menu
2. Click **Line of Sight**
3. The analysis runs between all node pairs, or only between selected nodes (select 2+ nodes for a subset)

### Understanding Results

LOS links appear as colored lines on the map between node pairs. Each link includes:

- **Distance** — Straight-line distance between the two nodes
- **Signal Strength** — Predicted received signal in dBm
- **Link Margin** — How much signal headroom above the receiver sensitivity (higher is better)
- **Link Quality** — Classified as Strong, Marginal, NLOS (non-line-of-sight), or Not Viable
- **Fresnel Clearance** — Percentage of the first Fresnel zone that is clear of terrain
- **Max Obstruction** — Height of terrain above the direct radio path (0 if clear)
- **Path Loss** — Total signal loss including free-space and terrain effects

### Terrain Profile View

When you select a link, a terrain elevation profile shows:

- **Ground elevation** between the two points (brown fill)
- **Direct radio path** (straight line between antennas)
- **First Fresnel zone boundary** (the elliptical zone around the direct path where signal integrity matters)
- **Obstruction points** where terrain enters the Fresnel zone

A clear Fresnel zone (60%+ clearance) indicates a good radio path. Obstructions in the Fresnel zone cause signal degradation even if the direct line-of-sight is clear.

### Link Report

For a comprehensive view of all links, use Tools menu → **Link Report**. This opens a sortable table showing every node pair with all link metrics. Links are sorted with the weakest connections first, so you can quickly identify problem areas.

---

## Network Topology

The topology view shows the logical structure of your mesh network — which nodes can communicate and how the network connects.

### Viewing the Topology

After running LOS analysis, the topology information is available in the Plan Info panel. The network statistics show:

- **Total Nodes** — Count of all devices in the plan
- **LOS Links** — Number of viable radio links between node pairs
- **Connected Components** — Number of separate network segments. Ideally this is 1 (all nodes in one connected network). If it's more than 1, some nodes are isolated.
- **Coverage Overlays** — Number of active coverage calculations

### Resilience Metrics

A resilient mesh network has multiple paths between important nodes. Key metrics:

- **Articulation Points** — Nodes whose removal would split the network into separate parts. These are single points of failure and should be addressed by adding redundant paths.
- **Network Diameter** — The maximum number of hops between any two nodes. Lower is better for latency.

### Improving Resilience

If the analysis identifies articulation points:

1. Look at where the network has only one path between groups of nodes
2. Add relay nodes to create alternative paths
3. Re-run LOS analysis to verify the new links
4. The articulation point should disappear once redundant paths exist

A well-designed mesh network should have at least 2 independent paths between critical nodes.

---

## Analysis Tools

Beyond basic propagation and LOS, the Tools menu provides several advanced analysis capabilities.

### Viewshed Analysis

Viewshed shows which areas and nodes are visible from a selected observer node, based on terrain:

1. Select a single node on the map
2. Open Tools menu → **Viewshed Analysis**
3. The result shows:
   - Visible nodes (green indicators) — clear line of sight
   - Blocked nodes (red indicators) — terrain obstructs the view
   - Distance to each node
   - Maximum terrain obstruction height

This is useful for siting relay nodes on hilltops or towers — you can see exactly which parts of your network a given location can reach.

### LoRa Airtime Calculator

Calculate how long a LoRa packet takes to transmit on air:

1. Open Tools menu → **LoRa Airtime Calculator**
2. Select a modem preset (or configure manually):
   - Spreading Factor (SF5–SF12)
   - Bandwidth (125, 250, or 500 kHz)
   - Coding Rate (4/5, 4/6, 4/7, or 4/8)
3. Set payload size in bytes
4. Configure preamble length, header mode, and CRC
5. The calculator shows:
   - **Airtime** — Duration of the transmission in milliseconds
   - **Data Rate** — Effective throughput in bits per second
   - **Duty Cycle** — How this airtime relates to regulatory duty cycle limits

A comparison table at the bottom shows airtime for the same payload across all modem presets, so you can quickly see the trade-offs between range and speed.

### Channel Capacity Estimator

Estimate how much traffic your mesh network can handle before congestion becomes a problem:

1. Open Tools menu → **Channel Capacity Estimator**
2. Enter:
   - Number of nodes in the network
   - Messages per minute per node
   - Payload size in bytes
   - Modem preset (spreading factor, bandwidth, coding rate)
   - Duty cycle limit (100% for US ISM, 10% for EU 868, 1% for EU sub-band, or custom)
3. Results show:
   - **Channel Utilization** — Percentage of available airtime in use. Color-coded: green (<30%), yellow (30–70%), red (>70%).
   - **Collision Probability** — Likelihood of packet collisions using the Pure ALOHA model
   - **Optimal Modem Preset** — Recommendation for the best preset given your traffic pattern

### Message Flooding Simulation

Simulate how a message propagates through your mesh network hop by hop:

1. Open Tools menu → **Message Flooding Sim**
2. Select the source node
3. Configure payload size and inter-node delay
4. Run the simulation

The result shows an animated visualization:
- Wave-by-wave expansion showing how the message spreads through the network
- Hop count badges on each reached node
- Time-on-air for each hop
- Unreached nodes highlighted (network gaps)
- Critical bridge nodes identified
- Network health scoring (connectivity and resilience)

You can also simulate node failure — remove a node and see how it affects message delivery across the network.

### Node Placement Suggestions

Let the app recommend optimal locations for additional nodes to maximize coverage:

1. Open Tools menu → **Suggest Node Placement**
2. Configure the search:
   - Search radius (meters) — How far from existing nodes to search
   - Grid resolution (meters) — Spacing between candidate positions
   - Max candidates — Number of suggestions to return
3. Run the analysis

Results appear as ghost markers on the map, color-coded by score:
- **Green** (score > 0.7) — Excellent placement
- **Yellow** (score 0.4–0.7) — Good placement
- **Red** (score < 0.4) — Marginal improvement

Each suggestion includes the coverage gain in km² and a brief explanation of why that location was recommended. Click **Accept** on any suggestion to add it as a new node.

### Route Finding

Find the shortest multi-hop path between two nodes:

1. Select exactly 2 nodes on the map
2. Open Tools menu → **Find Route**
3. The result shows the optimal path and alternatives:
   - Primary route (fewest hops)
   - Alternative routes if available
   - Per-link quality along each route
   - Total distance and hop count

### Elevation Heatmap

Overlay a terrain elevation layer on the map to visualize the topography of your deployment area:

1. Open the **Tools** menu
2. Click **Elevation Heatmap** to toggle it on (a checkmark appears when active)
3. The map shows colored terrain overlaid on the base map tiles

**Color scale** (blue → green → yellow → orange → red → white):

| Color | Elevation | Terrain |
|-------|-----------|---------|
| Steel blue | Below sea level | Valleys, depressions |
| Forest green | 0 m (sea level) | Coastal areas |
| Medium green | 50 m | Lowland plains |
| Yellow-green | 200 m | Low hills |
| Bright yellow | 500 m | Uplands |
| Amber | 800 m | Foothills |
| Deep orange | 1,200 m | Lower mountains |
| Terracotta | 2,000 m | Mid-altitude mountains |
| Gray | 3,000 m | Alpine, above treeline |
| White | 4,500 m+ | Snow and glacier |

**Elevation range sliders:** The legend panel includes Min and Max elevation sliders that let you narrow the color ramp to a specific elevation range. This is essential for flat areas where local variation is invisible at the full -500m to 9000m scale.

For example, if you're planning a network in Wisconsin (elevations ~160m to ~360m), set Min to 150 and Max to 400. The full color spectrum now stretches across just 250m of local elevation, making terrain features dramatically more visible.

- **Min Elevation** — Sets the bottom of the color range (default: -500m). Terrain at or below this value appears steel blue.
- **Max Elevation** — Sets the top of the color range (default: 9000m). Terrain at or above this value appears snow white.
- **Live preview:** The legend swatches and their labels update in real time as you drag the sliders.
- **Reset button:** When the range differs from the default, a "Reset" button appears next to the title. Click it to restore the full -500m to 9000m range.

**Setting elevation values:**

You have three ways to set the Min and Max values:

1. **Drag the slider** — Click and drag left/right for coarse adjustment.
2. **Type a number directly** — Click the numeric field next to each slider and type any value. Press **Enter** or click elsewhere to apply. The value is automatically clamped to a valid range.
3. **Mouse wheel fine-tuning** — Click a slider to focus it, then scroll the mouse wheel to nudge the value by 10m per tick.

**Keyboard navigation:**

All controls in the elevation legend are fully keyboard-accessible:

| Key | Action |
|-----|--------|
| **Tab** | Move between sliders, number inputs, checkbox, and opacity slider |
| **Arrow keys** | Move focused slider by 10m |
| **Page Up / Page Down** | Move focused slider by 100m |
| **Enter** | Commit a typed number-field value |
| **Escape** | Cancel editing a number field |

**Remembering your range across sessions:**

Check the **"Remember range"** checkbox in the legend panel. The current Min/Max values are saved in your browser's local storage and automatically restored the next time you open the application. Uncheck the box to clear the saved range and revert to the defaults (-500m / 9000m) on next launch.
- **Tile re-rendering:** When you release the slider, the map tiles re-render with the new color mapping. Different ranges are cached separately, so switching between ranges you've used before is instant.

**Opacity control:** When the elevation layer is active, the legend panel also includes a slider to adjust transparency (0–100%). Lower opacity lets the base map show through more clearly.

**Zoom range:** Elevation tiles render at zoom levels 9–15. Below zoom 9 the view is too wide for meaningful detail; above zoom 15 you exceed the 30 m resolution of the SRTM data.

**Data source:** Elevation data comes from NASA's Shuttle Radar Topography Mission (SRTM1) at 1 arc-second (~30 m) resolution. Tiles are downloaded automatically from AWS when you pan to a new area — no API key or account required. Downloaded tiles are cached locally so subsequent views load instantly.

**Use cases:**
- Identify ridgelines and valleys before placing nodes
- Understand why certain line-of-sight links are blocked
- Find high-ground locations for relay nodes
- Visualize terrain context when presenting plans to stakeholders
- Use range sliders to reveal subtle terrain in flat areas (plains, coastal regions, river valleys)
- Narrow the range to highlight specific elevation bands relevant to your deployment

### Save Screenshot

Capture the current map view as a PNG image: Tools menu → **Save Screenshot**. Useful for reports and presentations.

---

## Bill of Materials

The BOM aggregates all hardware from your plan into a shopping list with quantities and estimated pricing.

### Generating a BOM

1. Open the **Tools** menu
2. Click **Export Material List**

The BOM modal opens with three tabs:

### Consolidated View

All items aggregated across every node in the plan. Identical components are combined with a total quantity. This is your purchasing list.

| Category | Example Items |
|----------|---------------|
| Device | T-Beam, Heltec V3, RAK19007 |
| Antenna | 915 MHz 3 dBi Omni, 868 MHz Yagi |
| Cable | SMA to N-Female coaxial, U.FL pigtail |
| Connector | SMA adapter, N-type adapter |
| PA Module | Power amplifier modules |
| Battery | 18650 cells, LiPo packs |
| Solar Panel | 5W, 10W, 20W panels |
| BEC | Voltage regulators |
| Charge Controller | Solar charge controllers |
| Enclosure | Weatherproof cases |
| Mast | Mounting poles and brackets |

Each line shows the item name, description, quantity, unit price (USD), and total price.

### Per-Node View

A detailed breakdown for each individual node, showing exactly what hardware goes at each site. Useful for preparing installation kits — you can see exactly what to bring to each location.

### Exporting the BOM

- **Export CSV** — Spreadsheet format you can open in Excel, Google Sheets, or LibreOffice Calc. Ideal for adding vendor links, adjusting quantities, and tracking purchases.
- **Export PDF** — Formatted report with plan summary, BOM table, and cost breakdown. Suitable for sharing with stakeholders or including in project proposals.
- **Export Deployment Cards** — One PDF page per node with location coordinates, complete hardware configuration, radio settings (frequency, TX power, spreading factor, bandwidth, coding rate, firmware, region, modem preset, antenna height), and installation notes. Print these and take them to the field.

### Network Report (PDF)

For a comprehensive professional report, use Tools menu → **Export Network Report (PDF)**. You can select which sections to include:

- Executive Summary
- Topology Map Screenshot
- Node Inventory Table
- Link Quality Table (requires LOS analysis)
- Coverage Statistics (requires coverage analysis)
- BOM Summary
- Recommendations

Choose Letter or A4 page size and click **Generate**.

---

## Import and Export

### Plan Files (.meshplan)

The native plan format stores your complete network design as a JSON file with an integrity checksum.

**Exporting a plan:**
1. Open the **Plan** menu
2. Click **Export Plan**
3. Choose a save location
4. The `.meshplan.json` file contains all nodes, configurations, and metadata

**Importing a plan:**
1. Open the **Plan** menu
2. Click **Import Plan(s)**
3. Select one or more `.meshplan.json` files
4. The plans are loaded into your database

### CSV — Nodes

**Export:** Plan menu → **Export Nodes (CSV)** saves all node locations and configurations as a spreadsheet.

**Import:** Plan menu → **Import Nodes (CSV)** adds nodes from a CSV file. Required columns: `name`, `latitude`, `longitude`. Optional columns are auto-detected.

### Internet Map Import

Pull live node locations directly from an online mesh network directory:

1. Open the **Plan** menu
2. Click **Import Nodes (Internet)**
3. In the dialog, choose your source:
   - **MeshCore Map** — nodes registered at meshcore.nz
   - **Reticulum Network** — nodes from the directory.rns.recipes public directory
4. The map zooms to show available nodes in the current map view
5. A warning appears if more than 5 nodes will be imported at once
6. Click **Import** to add the nodes to your plan

**Offline guard:** The button is automatically disabled and labeled "(offline)" when no internet connection is detected. Map tiles and terrain analysis continue to work offline — only the live directory import requires connectivity.

### KML — Google Earth / Field Apps

Plan menu → **Export Plan (KML)** creates a `.kml` file and opens a guide with import instructions for compatible apps:

**Mobile:** ATAK CIV / iTAK / WinTAK, Caltopo, Gaia GPS, OsmAnd, Avenza Maps, OruxMaps

**Desktop:** Google Earth, QGIS, ArcGIS, Google My Maps

KML files cannot be re-imported into the planner — they are for visualization and field reference only.

### GeoJSON — Web GIS

Plan menu → **Export Plan (GeoJSON)** creates a `.geojson` file for web mapping tools like Mapbox, Leaflet, or QGIS.

### CoT/TAK — Military Mapping

Plan menu → **Export Plan (CoT/TAK)** creates a Cursor-on-Target XML file compatible with TAK (Team Awareness Kit) and ATAK (Android TAK) military mapping systems.

---

## Hardware Catalog

The built-in hardware catalog contains real LoRa devices, antennas, cables, PA modules, and power components with their specifications and pricing. You can browse, add custom items, edit, and delete entries.

### Opening the Catalog

Open the **Catalog** menu in the toolbar and click **Manage Catalog**.

### Catalog Tabs

The catalog has 7 tabs:

**Devices** — LoRa radio modules and boards. Fields include: name, MCU, radio chip, max TX power, frequency bands, GPS, Bluetooth, WiFi, battery type, capacity, form factor (handheld, module, compact, dev board), price, firmware compatibility, and power consumption (TX/RX/sleep current in mA).

**Antennas** — Antenna options with gain, polarization, form factor (whip, omni, yagi, panel, dish), connector type, impedance, VSWR, and price.

**Cables** — Coaxial cables with connector types, length, loss per meter, and price. Common connectors include SMA, N-Female, U.FL, and Reverse SMA.

**PA Modules** — Power amplifier modules with gain, max output power, input power range, frequency band, and price.

**Power** — Batteries, solar panels, BECs (voltage regulators), charge controllers, enclosures, and masts with specifications and pricing.

**Regions** — Read-only reference table of regulatory presets (US FCC, EU 868, EU 433, ANZ) showing allowed frequencies, max TX power, and duty cycle limits.

**Modem Presets** — Predefined radio configurations including:
- LongFast (SF11, 250 kHz, 4/5) — Default, good balance of range and speed
- LongSlow (SF12, 125 kHz, 4/8) — Maximum range, slowest speed
- LongModerate (SF11, 125 kHz, 4/8)
- MediumSlow (SF11, 250 kHz, 4/8)
- MediumFast (SF9, 250 kHz, 4/5)
- ShortSlow (SF8, 250 kHz, 4/5)
- ShortFast (SF7, 250 kHz, 4/5) — Shortest range, fastest speed
- ShortTurbo (SF5, 500 kHz, 4/5) — Fastest, very short range
- MeshCore-US (SF11, 250 kHz, 4/7)

### Managing Catalog Items

- **Add:** Click the Add button on any tab to create a custom item
- **Edit:** Click an existing item to modify its specifications
- **Delete:** Remove custom items you no longer need
- **Reset to Defaults:** Restore the factory catalog for any table
- **Export:** Export any catalog table as CSV for backup or sharing
- **Import:** Import a CSV to add items (merge mode adds new items; replace mode overwrites)

A guided tour is available on first use of the catalog to walk you through the interface.

---

## Settings

Settings are accessible from the application interface and persist across sessions.

### Display Settings

- **Unit System** — Metric (km, m) or Imperial (mi, ft). Affects all distance displays. Internal calculations always use metric; conversion is display-only.
- **Color Palette** — Color scheme for map visualizations. Options include:
  - Viridis (default) — General-purpose green/blue/purple gradient
  - Deuteranopia-safe — Red-green colorblind friendly
  - Protanopia-safe — Red-green colorblind friendly (alternate)
  - Tritanopia-safe — Blue-yellow colorblind friendly
  - High Contrast — Maximum visibility for low vision
  - Cividis — Perceptually uniform (scientific use)

### Cache Settings

- **Map Cache Limit** — Maximum disk space for cached map tiles (default: 500 MB)
- **Terrain Cache Limit** — Maximum disk space for SRTM elevation data (default: 1000 MB)
- **Total Cache Limit** — Overall cache limit (default: 2000 MB)

### Solar and Power Settings

- **Peak Sun Hours** — Average peak sun hours per day at your location. Used for solar panel sizing calculations. Default: 4 hours.
- **Battery Autonomy** — Desired number of days a battery-powered node should last without charging. Default: 3 days.

### Analysis Settings

- **Signal-Server Concurrency** — Number of parallel propagation calculations to run simultaneously. Default: 2. Increase for faster analysis on multi-core machines; decrease if the app slows down your computer.

---

## Keyboard Shortcuts

### Map Navigation

| Action | Shortcut |
|--------|----------|
| Pan map | Arrow keys |
| Zoom in | `+` or `=` |
| Zoom out | `-` |
| Reset zoom | `Ctrl+0` |
| Center on all nodes | `Home` |

### Node Operations

| Action | Shortcut |
|--------|----------|
| Add node | `Insert` |
| Delete selected node | `Delete` |
| Select next node | `Tab` |
| Select previous node | `Shift+Tab` |
| Focus on selected node | `Enter` |

### General

| Action | Shortcut |
|--------|----------|
| Close modal/dialog | `Escape` |

---

## Tips and Best Practices

### Planning Your Network

- **Start with the gateway.** Place your internet-connected gateway node first, typically at the highest available point with reliable power.
- **Work outward.** Add relay nodes to extend coverage from the gateway toward your target area.
- **Elevation matters most.** A node at 10m height on a hill will outperform a node at 2m height in a valley, even with higher TX power.
- **Run LOS analysis early.** Before adding many nodes, check that your first few nodes can actually see each other through the terrain.
- **Use the placement suggestion tool.** After placing your initial nodes, let the app recommend where to add relays for maximum coverage gain.

### Hardware Selection

- **Match firmware across your network.** All nodes in a mesh must run the same firmware (Meshtastic, MeshCore, or Reticulum) to communicate.
- **Don't over-spec.** A simple Heltec V3 with a stock antenna works well for many deployments. Save high-gain antennas and PA modules for long links.
- **Account for cable loss.** If you're running a long coaxial cable to a rooftop antenna, the cable loss may negate the antenna gain. Use low-loss cable.

### Propagation Analysis

- **FSPL circles are optimistic.** They assume flat terrain. Always run terrain-aware propagation before making hardware decisions.
- **Check Fresnel clearance.** Even with visual line-of-sight, obstructions in the Fresnel zone degrade signal quality. 60%+ clearance is good.
- **Terrain data caches.** Once you've viewed an area, the SRTM tiles are stored locally. Plan your coverage area while online, then work offline.

### Offline Use

After viewing an area on the map (tiles cache) and running propagation once (terrain data caches), the entire app works offline. If you're planning a field trip:

1. While online, navigate the map to your entire deployment area at the zoom levels you'll use
2. Run at least one propagation analysis to download the terrain data
3. The app will now function completely offline for that area

### Collaboration

While the app stores data locally, you can share plans with others:

1. Export your plan as a `.meshplan.json` file
2. Share the file via email, USB drive, or file sharing
3. The recipient imports the file into their instance
4. Each person works independently with their own copy

---

**End of User Guide**

For quick walkthroughs, see the [Quick Start Tutorials](QUICK-START-TUTORIALS.md).
For common issues, see [Troubleshooting](TROUBLESHOOTING.md).
For technical terms, see the [Technical Glossary](TECHNICAL-GLOSSARY.md).
For answers to common questions, see the [FAQ](FAQ.md).

*Last Updated: March 2026*
*Version: 1.3.3*
