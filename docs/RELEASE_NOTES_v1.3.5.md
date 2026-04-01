# Release Notes — v1.3.5

## What's New

### Meshtastic MQTT Import

Pull live node positions directly from a Meshtastic MQTT broker.

Open **Plan → Import Nodes (Internet)** and select the **Meshtastic MQTT** source. Enter your broker URL (defaults to `mqtt.meshtastic.org` for the public Meshtastic network, or your local broker's IP address), set a listen duration (5–60 seconds), and click **Fetch**. The app subscribes to the JSON MQTT topic (`msh/+/+/json/#`), collects nodeinfo and GPS position messages, and shows a filterable preview of all located nodes. Select the ones you want and import them into your plan in one step.

![Meshtastic MQTT import dialog showing the source card selected, broker URL input, and duration slider](https://raw.githubusercontent.com/PapaSierra555/MeshCommunityPlanner/main/docs/screenshots/MeshtasticMQTT.png)

Nodes are imported with the same radio defaults as your existing plan nodes — antenna height, device, firmware family, region — so they're ready for coverage analysis immediately.

> **Requirements:** Nodes must be publishing to the Meshtastic JSON MQTT gateway topic. On the public broker, this works out of the box for most networks. On a private encrypted network, the topic filter may need to match your channel configuration.

---

### Extended Coverage Analysis Radius

The coverage analysis radius slider now allows up to **200 km**.

Previously the slider was hard-capped to the radio horizon formula for the node's configured antenna height, which gave approximately 11–15 km for typical ground-level deployments. The formula is still shown as a guidance label ("Radio horizon at X m: ~Y km") but is no longer a hard ceiling.

For mountain-top and elevated relay nodes: set the **Antenna Height** field to reflect actual clearance above surrounding terrain — not altitude above sea level, but how many meters the antenna clears nearby obstacles. At 50 m clearance the recommended horizon is ~34 km; at 200 m it's ~64 km. The slider can be set beyond the formula up to 200 km absolute maximum.

![Coverage radius slider set to 102 km with radio horizon guidance label visible](https://raw.githubusercontent.com/PapaSierra555/MeshCommunityPlanner/main/docs/screenshots/MaxRadius.png)

> **Physics note:** LoRa at legal power limits can realistically reach 80–150 km mountain-to-mountain with high-gain antennas. Beyond ~200 km, earth curvature becomes the dominant constraint regardless of software settings.

---

### Lock Node Positions

A new **Lock Node Positions** toggle prevents nodes from being accidentally dragged while reviewing a plan.

Select any node, then check **Lock node positions** in the node sidebar (just above the radio horizon readout). The lock applies globally — all nodes on the map become non-draggable immediately, including nodes added after enabling it. Uncheck to resume normal drag behavior.

The lock state is saved in exported `.meshplan.json` files and restored automatically on import.

> **Note:** The checkbox appears in the node sidebar, which is only visible when a node is selected. It controls all nodes globally, not just the selected one.

*Contributed by [@nakoeppen](https://github.com/nakoeppen).*

---

### Linux arm64 (aarch64) AppImage

A native **aarch64 AppImage** is now available for Raspberry Pi 4/5, Qualcomm Snapdragon X, and other 64-bit ARM Linux devices.

To check your architecture: `uname -m` — `aarch64` means use the ARM build; `x86_64` means use the standard build.

---

## Under the Hood

- **Signal-Server documented:** origin (W3AXL fork of CloudRF/Signal-Server), installation, bundling instructions, and feature degradation behavior fully documented in the Installation Guide and PyInstaller spec.
- **Linux AppImage arch-aware:** `build_appimage.sh` auto-detects architecture via `uname -m` and produces correctly named output.
- **Coverage analysis backend cap:** raised from 50 km to 200 km (`max_radius_m` field validation).
- **paho-mqtt added** as a dependency for MQTT broker connectivity.

---

**Download:** See the [GitHub Releases page](https://github.com/PapaSierra555/MeshCommunityPlanner/releases) for Windows, macOS (Apple Silicon + Intel), and Linux (x86_64 + aarch64) installers.
