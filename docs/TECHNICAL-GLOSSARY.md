# Technical Glossary — Mesh Community Planner

**Purpose:** Definitions of technical terms used in Mesh Community Planner
**Audience:** End users, community organizers, non-technical planners
**WCAG 2.2 AAA Compliance:** Satisfies 3.1.3 (Unusual Words) and 3.1.4 (Abbreviations)

---

## A

### Antenna
**Definition:** A device that transmits and receives radio signals. In mesh networks, the antenna converts electrical signals into radio waves and vice versa.

**Types:**
- **Omnidirectional:** Radiates signal equally in all directions (360°)
- **Directional:** Focuses signal in one direction for longer range

**Related:** Antenna Height, Gain

---

### Antenna Height
**Definition:** The vertical distance from the ground to the antenna, measured in meters or feet. Higher antennas typically achieve better line-of-sight and longer range.

**Typical Values:**
- Ground level: 0-3m (portable devices)
- Rooftop: 6-15m (residential installations)
- Tower: 20-100m (high-altitude installations)

**Related:** Elevation, Line-of-Sight

---

### API (Application Programming Interface)
**Definition:** A set of rules and protocols that allows different software systems to communicate. In Mesh Community Planner, the backend provides a REST API that the frontend uses to manage plans, nodes, and analysis.

---

### Articulation Point
**Definition:** A node in a mesh network whose removal would disconnect the network into separate parts. Also called a "single point of failure."

**Example:** If removing one relay node causes 5 other nodes to lose connection to the gateway, that relay is an articulation point.

**Why It Matters:** Networks should minimize articulation points for resilience.

**Related:** Topology, Resilience

---

## B

### BOM (Bill of Materials)
**Definition:** A comprehensive list of all hardware and equipment needed to build the planned mesh network, including quantities and estimated costs.

**Includes:**
- Node devices (gateways, relays, clients)
- Antennas and cables
- Power supplies (solar panels, batteries)
- Mounting hardware
- Installation materials

**Related:** Cost Estimate, Hardware

---

### Broadband
**Definition:** High-speed internet access, typically ≥25 Mbps download. Mesh networks can provide internet access when connected to a broadband gateway.

**Note:** LoRa mesh networks are **not** broadband—they provide low-bandwidth data for sensors and messages, not internet streaming.

---

## C

### Cache
**Definition:** Temporary storage of data to speed up future access. Mesh Community Planner caches map tiles and terrain data to work offline.

**Benefits:**
- Faster loading (no re-download)
- Offline functionality
- Reduced bandwidth usage

**Related:** Offline Mode, Storage

---

### Client Node
**Definition:** An endpoint device in a mesh network that sends and receives data but doesn't relay traffic for other nodes.

**Examples:** Sensors, handhelds, IoT devices

**Related:** Gateway, Relay, Node

---

---

### Coverage
**Definition:** The geographic area where a mesh network provides signal. Typically measured as a percentage of the target area with adequate signal strength.

**Types:**
- **Predicted coverage:** Calculated via propagation models
- **Actual coverage:** Measured via real-world testing

**Related:** Propagation, Signal Strength

---

## D

### dBm (Decibels Milliwatt)
**Definition:** A unit of measurement for radio signal power, expressed in decibels relative to 1 milliwatt.

**Common Values:**
- 0 dBm = 1 mW (very low power)
- 14 dBm = 25 mW (typical LoRa)
- 20 dBm = 100 mW (common outdoor)
- 27 dBm = 500 mW (high power)
- 30 dBm = 1 W (legal limit in many regions)

**Key Concept:** Every 3 dBm doubles the power (e.g., 14 dBm → 17 dBm = 2x power).

**Related:** TX Power, Signal Strength

---

### Duty Cycle
**Definition:** The percentage of time a radio can transmit, imposed by regulations to prevent spectrum congestion.

**Example:** 1% duty cycle = can transmit for 36 seconds per hour maximum.

**Typical:** LoRa in unlicensed bands often has 1-10% duty cycle limits.

---

## E

### Elevation
**Definition:** Height above sea level, measured in meters or feet. Elevation affects line-of-sight and propagation.

**Examples:**
- Sea level: 0m
- Denver, CO: 1,609m (5,280 ft - "Mile High City")
- Mount Everest: 8,849m

**Note:** Elevation is geographic (terrain), while antenna height is relative to ground.

**Related:** Antenna Height, Terrain

---

## F

### Frequency
**Definition:** The number of radio wave cycles per second, measured in Hertz (Hz) or megahertz (MHz). Different frequencies have different propagation characteristics.

**LoRa Bands:**
- **915 MHz:** North America (902-928 MHz ISM band)
- **868 MHz:** Europe (863-870 MHz)
- **433 MHz:** Asia/Africa

**Key Concept:** Lower frequencies (e.g., 433 MHz) travel farther but require larger antennas. Higher frequencies (e.g., 2.4 GHz) have higher bandwidth but shorter range.

**Related:** LoRa, Spectrum

---

### Fresnel Zone
**Definition:** An elliptical area around the direct line between two antennas where radio waves can interfere with each other. Obstructions in the Fresnel zone can degrade signal.

**Clearance Guidelines:**
- 100% clear: Excellent signal (no obstructions)
- 60-99% clear: Good signal (minor obstructions OK)
- 40-59% clear: Marginal signal (noticeable degradation)
- <40% clear: Poor signal (may not work reliably)

**Why It Matters:** Even if you have line-of-sight, trees or buildings in the Fresnel zone can weaken the signal due to diffraction.

**Related:** Line-of-Sight, Propagation, Diffraction

---

### FSPL (Free Space Path Loss)
**Definition:** A radio propagation model that calculates signal loss in ideal conditions (no terrain, obstacles, or interference). Assumes clear line-of-sight in a vacuum.

**Formula:** FSPL (dB) = 20 log₁₀(distance) + 20 log₁₀(frequency) + 32.45

**Pros:** Fast, simple, no API required

**Cons:** Overly optimistic—doesn't account for real-world terrain or obstacles

**Compare:** ITM/Longley-Rice (terrain-aware)

**Related:** Propagation, Signal Loss

---

## G

### Gateway
**Definition:** The central node in a mesh network that connects to the internet or backhaul network. All data from client and relay nodes eventually routes to a gateway.

**Key Role:** Gateways are critical—if the gateway fails, the entire network loses internet connectivity (but local mesh communication may continue).

**Typical Setup:**
- High antenna (15-30m)
- High TX power (27-30 dBm)
- Reliable power (grid or large solar)
- Backhaul connection (fiber, cellular, satellite)

**Related:** Relay, Client, Backhaul

---

### Geocoding
**Definition:** Converting human-readable addresses into geographic coordinates (latitude/longitude) or vice versa.

**Examples:**
- "123 Main St, Denver, CO" → (39.7392° N, 104.9903° W)
- (37.7749° N, 122.4194° W) → "San Francisco, CA"

**Used by:** Address search bar (via Nominatim / OpenStreetMap)

---

## I

### ISM Band (Industrial, Scientific, Medical)
**Definition:** Unlicensed radio frequency bands reserved for non-commercial use. LoRa operates in ISM bands.

**Common ISM Bands:**
- 433 MHz (Europe, Asia)
- 868 MHz (Europe)
- 915 MHz (North America)
- 2.4 GHz (worldwide - WiFi, Bluetooth)

**Advantage:** No license required
**Disadvantage:** Shared with other devices, potential interference

---

### ITM (Irregular Terrain Model)
**Definition:** A sophisticated radio propagation model that accounts for terrain, elevation changes, and obstacles. Used by Signal-Server for terrain-aware propagation analysis.

**More Accurate Than:** FSPL (which assumes flat, obstacle-free terrain)

**Related:** Terrain, Propagation

---

## L

### Latitude
**Definition:** Geographic coordinate measuring north-south position, expressed in degrees from -90° (South Pole) to +90° (North Pole).

**Examples:**
- Equator: 0°
- North Pole: 90° N
- South Pole: 90° S
- San Francisco: 37.77° N

**Related:** Longitude, Coordinates

---

### Line-of-Sight (LOS)
**Definition:** A clear, unobstructed path between two antennas. Radio signals travel best with line-of-sight.

**Types:**
- **Optical LOS:** Can see one antenna from the other (visible)
- **Radio LOS:** No terrain blocking the Fresnel zone (may not be visible)

**Key Concept:** You can have optical LOS but still poor signal if the Fresnel zone is obstructed.

**Related:** Fresnel Zone, Terrain Profile

---

### Longitude
**Definition:** Geographic coordinate measuring east-west position, expressed in degrees from -180° (West) to +180° (East).

**Examples:**
- Prime Meridian (Greenwich, UK): 0°
- International Date Line: ±180°
- New York: 74° W (-74°)
- Tokyo: 139° E (+139°)

**Related:** Latitude, Coordinates

---

### LoRa (Long Range)
**Definition:** A wireless communication technology designed for long-range, low-power, low-bandwidth data transmission. Ideal for IoT sensors, environmental monitoring, and emergency communications.

**Characteristics:**
- **Range:** 2-15 km (varies by environment)
- **Bandwidth:** ~0.3-50 kbps (very low—not for video/voice)
- **Power:** Extremely low (battery life of months/years)
- **Frequency:** 433/868/915 MHz (unlicensed ISM bands)

**Use Cases:**
- Sensor networks (temperature, air quality)
- Asset tracking
- Smart agriculture
- Emergency alerts
- Mesh messaging

**Related:** Mesh Network, ISM Band

---

### LoRaWAN
**Definition:** A network protocol for LoRa that uses a star topology (all devices connect directly to a gateway). Different from LoRa mesh.

**Key Difference:** LoRaWAN = star (no device-to-device relay), Mesh = devices can relay for each other.

---

## M

### Mesh Network
**Definition:** A network topology where nodes can relay data for each other, creating multiple paths from source to destination. More resilient than star networks.

**Advantages:**
- Redundancy (multiple paths)
- Extended range (relay through multiple hops)
- Self-healing (reroutes if a node fails)

**Disadvantages:**
- More complex routing
- Higher latency (more hops)
- Bandwidth shared across hops

**Related:** Topology, Relay

---

### MHz (Megahertz)
**Definition:** One million cycles per second. Unit for measuring radio frequency.

**Examples:**
- FM radio: 88-108 MHz
- LoRa (North America): 902-928 MHz
- WiFi: 2,400-2,483 MHz

**Related:** Frequency

---

## N

### Node
**Definition:** Any device in the mesh network. Can be a gateway, relay, or client.

**Total Nodes:** Count of all devices in the network.

**Related:** Gateway, Relay, Client

---

## P

### Path Loss
**Definition:** Reduction in signal strength as radio waves travel through space. Measured in decibels (dB).

**Factors:**
- Distance (inverse square law)
- Frequency (higher frequency = more loss)
- Obstacles (trees, buildings, terrain)
- Atmospheric conditions

**Related:** FSPL, Propagation

---

### Propagation
**Definition:** The behavior of radio waves as they travel from transmitter to receiver. Affected by distance, terrain, frequency, and obstacles.

**Models:**
- **FSPL:** Simple, ideal conditions
- **ITM (Longley-Rice):** Terrain-aware, realistic

**Related:** Coverage, FSPL

---

## R

### Radio Horizon
**Definition:** The maximum distance a radio signal can travel before Earth's curvature cuts off line-of-sight, even in the absence of terrain obstacles. Shown in each node's detail panel as a function of antenna height.

**Formula:** d (km) ≈ 3.57 × √h, where h is antenna height in meters. The effective radio horizon between two nodes is the sum of each node's individual horizon distance.

**Example Values:**
- 1m antenna height → ~3.6 km horizon
- 3m → ~6.2 km
- 10m → ~11.3 km
- 30m → ~19.5 km
- 100m → ~35.7 km

**Key Concept:** The radio horizon is a theoretical upper bound. Real-world range is further limited by terrain obstructions, Fresnel zone clearance, and receiver sensitivity. Coverage analysis accounts for terrain and will show a tighter limit in hilly areas.

**Related:** Antenna Height, Line-of-Sight, Fresnel Zone

---

### Relay Node
**Definition:** An intermediate node that receives signals from other nodes and retransmits them, extending network range and providing redundancy.

**Key Role:** Relays enable multi-hop mesh networks, allowing data to reach nodes beyond direct gateway range.

**Typical Setup:**
- Medium antenna height (8-15m)
- Medium TX power (20-24 dBm)
- Solar powered (for remote locations)

**Related:** Gateway, Client, Mesh

---

### Resilience
**Definition:** A network's ability to maintain connectivity despite node failures. High resilience means multiple paths between nodes.

**Metrics:**
- **Articulation points:** Fewer is better
- **Redundant paths:** More is better
- **Node degree:** Nodes with many connections increase resilience

**Related:** Articulation Point, Topology

---

### RSSI (Received Signal Strength Indicator)
**Definition:** Measurement of received radio signal power at the antenna, expressed in dBm. Higher (less negative) is better.

**Typical Values:**
- -30 dBm: Excellent (very close)
- -60 dBm: Good (typical indoor)
- -80 dBm: Fair (typical outdoor)
- -100 dBm: Weak (edge of coverage)
- -120 dBm: Minimum detectable signal

**Key Concept:** RSSI is negative. -50 dBm is stronger than -90 dBm.

**Related:** dBm, Signal Strength, SNR

---

## S

### Signal Strength
**Definition:** The power of the received radio signal, typically measured as RSSI in dBm.

**Related:** RSSI, dBm

---

### SNR (Signal-to-Noise Ratio)
**Definition:** The ratio of desired signal power to background noise power, expressed in decibels (dB). Higher SNR means better signal quality.

**Typical Values:**
- >10 dB: Excellent
- 5-10 dB: Good
- 0-5 dB: Marginal
- <0 dB: Unusable (noise stronger than signal)

**Key Concept:** SNR is more important than RSSI alone. A weak signal with low noise (high SNR) is better than a strong signal with high noise (low SNR).

**Related:** RSSI, Noise

---

### Solar Power
**Definition:** Using photovoltaic panels to convert sunlight into electricity for powering nodes. Essential for remote installations without grid power.

**Components:**
- Solar panel (PV array)
- Charge controller
- Battery (for night/cloudy days)
- DC-DC converter (voltage regulation)

**Sizing:** Panel and battery sized for:
- Daily energy consumption (W·h)
- Days of autonomy (cloudy days without sun)
- Geographic location (hours of sunlight per day)

**Related:** Power, Battery

---

## T

### Terrain
**Definition:** The physical features of the land surface, including elevation changes, hills, valleys, and obstacles. Terrain significantly affects radio propagation.

**Data Sources:**
- SRTM (Shuttle Radar Topography Mission) - 30m resolution
- ASTER - 30m resolution
- Lidar - <1m resolution (high accuracy)

**Related:** Elevation, Propagation

---

### Terrain Profile
**Definition:** A cross-sectional view of the terrain between two points, showing elevation changes and potential obstacles.

**Use:** Identify hills, valleys, or structures that may block line-of-sight.

**Related:** Line-of-Sight, Fresnel Zone

---

### Topology
**Definition:** The arrangement and interconnection of nodes in a network. Shows which nodes can communicate directly.

**Types:**
- **Star:** All nodes connect to central gateway (not mesh)
- **Mesh:** Nodes interconnected with multiple paths
- **Tree:** Hierarchical structure

**Related:** Mesh Network, Articulation Point, Resilience

---

### TX Power (Transmit Power)
**Definition:** The amount of radio power a transmitter outputs, measured in dBm or milliwatts (mW).

**Legal Limits:**
- Most regions: 30 dBm (1 W) maximum for unlicensed ISM bands
- Some regions: Lower limits (e.g., 14 dBm)

**Trade-off:**
- Higher TX power = longer range, more battery drain
- Lower TX power = shorter range, better battery life

**Related:** dBm, Power

---

## U

### Uplink / Downlink
**Definition:**
- **Uplink:** Data transmission from a node to the gateway
- **Downlink:** Data transmission from the gateway to a node

**Related:** Gateway

---

## W

### WCAG (Web Content Accessibility Guidelines)
**Definition:** International standards for making web content accessible to people with disabilities.

**Levels:**
- **A:** Basic accessibility
- **AA:** Industry standard (required for many regulations)
- **AAA:** Highest level (enhanced accessibility)

**Mesh Community Planner:** WCAG 2.2 AA compliant (85/100 score), working toward AAA.

---

## Abbreviations Reference

| Abbreviation | Full Term | Quick Definition |
|--------------|-----------|------------------|
| **API** | Application Programming Interface | Software communication protocol |
| **BOM** | Bill of Materials | List of hardware and costs |
| **dBm** | Decibels Milliwatt | Radio power measurement |
| **FSPL** | Free Space Path Loss | Ideal propagation model |
| **IoT** | Internet of Things | Connected sensors/devices |
| **ISM** | Industrial, Scientific, Medical | Unlicensed radio bands |
| **ITM** | Irregular Terrain Model | Terrain-aware propagation |
| **LoRa** | Long Range | Low-power wireless technology |
| **LOS** | Line-of-Sight | Clear path between antennas |
| **MHz** | Megahertz | Million cycles per second |
| **RSSI** | Received Signal Strength Indicator | Signal power measurement |
| **SNR** | Signal-to-Noise Ratio | Signal quality measurement |
| **SRTM** | Shuttle Radar Topography Mission | Terrain data source |
| **TX** | Transmit | Sending radio signals |
| **WCAG** | Web Content Accessibility Guidelines | Accessibility standards |

---

## Usage in HTML

To make abbreviations accessible, use the `<abbr>` tag with a `title` attribute:

```html
<abbr title="Long Range">LoRa</abbr> operates in the
<abbr title="Industrial, Scientific, Medical">ISM</abbr> band at
<abbr title="megahertz">MHz</abbr> frequencies.
```

Screen readers will announce the expansion when encountering abbreviated terms.

---

## Related Documentation

- **USERGUIDE.md:** Step-by-step usage instructions
- **TROUBLESHOOTING.md:** Common issues and solutions
- **SETTINGS-TOOLTIPS.md:** In-app help text
- **WIZARD-TOOLTIPS.md:** Node wizard field explanations

---

**Maintained by:** W5 (QA, Accessibility & Documentation)
**Last Updated:** 2026-02-08
**WCAG 2.2 AAA Compliance:** ✅ Satisfies 3.1.3 (Unusual Words) and 3.1.4 (Abbreviations)

---

**End of Glossary**
