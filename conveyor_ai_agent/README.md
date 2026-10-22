# BeltGuard AI - Conveyor Belt Monitoring System
### AI-Powered ESP32-CAM Laser Triangulation, Inductive Joint Tracking & Predictive Maintenance

---

## 1. Executive Overview

BeltGuard AI is an industrial embedded computer vision and predictive reliability platform. It continuously inspects moving conveyor belts using sheet-of-light laser triangulation on an ESP32-CAM, tracks vulcanized belt joints via inductive proximity sensing, predicts Remaining Useful Life (RUL) under DIN 22102/ISO 15236 standards, and activates a deterministic servo spray marker on critical defects.

Google Gemini (`gemini-3.8-flash`) provides strategic root-cause evaluation, risk ranking, and shift maintenance recommendations without impeding real-time local control.

```
+-----------------------------------------------------------------------------------------+
|                                    CONVEYOR BELT LOOP                                   |
|                                                                                         |
|       [Inductive Sensor]              [Laser + Camera Head]           [Marking Station] |
|        (Vulcanized Joint)              (Triangulation Scan)            (SG90 Spray Can) |
|               |                                 |                             |         |
|               v                                 v                             v         |
|         GPIO 12 (Opto)                    OV2640 Sensor                  GPIO 13 (PWM)  |
|               |                                 |                             |         |
|               +----------------+  +-------------+                             |         |
|                                |  |                                           |         |
|                                v  v                                           |         |
|                      +------------------------+                               |         |
|                      |  ESP32-CAM Controller  | ------------------------------+         |
|                      |   Core 0: CV & Laser   |   Speed-Compensated Transit Delay       |
|                      |   Core 1: Sensor Fusion|                                         |
|                      +------------------------+                                         |
|                                  |                                                      |
|                             Wi-Fi / JSON                                                |
|                                  v                                                      |
|                      +------------------------+       +-------------------------------+ |
|                      |   FastAPI / Express    | <===> |     Google Gemini 3.8 Flash   | |
|                      |   Backend Server       |       |  (Predictive Reliability AI)  | |
|                      +------------------------+       +-------------------------------+ |
|                                  |                                                      |
|                                  v                                                      |
|                      +------------------------+                                         |
|                      |   Monitoring Console   |                                         |
|                      |  (Streamlit / Web Twin)|                                         |
|                      +------------------------+                                         |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Hardware Architecture & GPIO Pin Conflict Verification

The AI-Thinker ESP32-CAM module dedicates most GPIOs to the OV2640 parallel camera interface and onboard flash LED. Peripheral pins must be chosen with extreme care to avoid boot strapping conflicts or camera corruption:

| Peripheral | ESP32-CAM GPIO | Conflict Check & Hardware Design Rule |
| :--- | :--- | :--- |
| **Proximity Sensor Input** | **GPIO 12** | HS2_DATA2. Must NOT be pulled HIGH during boot (strapping pin for VDD_SDIO). Use PC817 optocoupler with active-low pulse. |
| **SG90 Servo PWM** | **GPIO 13** | HS2_DATA3. Assigned to LEDC Channel 0 (50 Hz). Safe for output after boot. |
| **Laser Diode Gate** | **GPIO 14** | HS2_CLK. Gates N-channel MOSFET for 650nm/520nm line laser. Safe for digital output. |
| **Calibrate / Zero Button**| **GPIO 15** | HS2_CMD. Internal pullup enabled. Active-low momentary pushbutton. |
| **Heartbeat LED** | **GPIO 33** | Onboard small red LED (inverted logic). Active-low. |
| *Camera Interface* | GPIO 0, 5, 18, 19, 21, 22, 23, 25, 26, 27, 32, 34, 35, 36, 39 | Dedicated to OV2640 DMA bus. Do NOT connect external loads. |
| *Flash LED* | GPIO 4 | High-current flash LED. Kept OFF during laser triangulation to maximize stripe contrast. |

### Electrical Isolation & Power Isolation Rules:
1. **Inductive Proximity Sensor Isolation:**
   - Industrial proximity sensors (e.g., LJ12A3-4-Z/BX NPN NO) operate at 10V–30V DC.
   - **NEVER connect a 12V sensor line directly to an ESP32 GPIO.**
   - Wire sensor collector to a **PC817 optocoupler** input (with a 2.2kΩ series resistor). The optocoupler phototransistor pulls GPIO 12 to GND when the metal flag is detected.
2. **SG90 Servo Power Isolation:**
   - SG90 servo stall currents reach 600mA–800mA, causing severe brownouts and ESP32 resets if connected to the ESP32 3.3V or 5V pin.
   - **Power the SG90 from a dedicated 5V 2A buck converter (LM2596 or MP1584)**. Share a common GND rail with the ESP32.
3. **Vulcanized Joint Target Arrangement:**
   - Rubber conveyor belting is non-conductive. The inductive proximity sensor cannot sense rubber.
   - Embed a **0.5mm 316-grade stainless steel shim or mild steel plate** inside the vulcanized step splice seam or clamp a low-profile target bracket to the splice edge guide.

---

## 3. Optical Laser Triangulation Principles

1. **Light Sheet Geometry:**
   - A laser line projector projects a sheet of light across the belt width at angle $\theta = 45^\circ$.
   - The camera looks down vertically ($90^\circ$ to belt surface).
   - Any physical depression or gouge causes the laser line to deflect along the camera sensor's Y-axis:
     $$\Delta Z = \frac{\Delta Y_{px} \cdot s_{scale}}{\sin(\theta)}$$
2. **Sub-Pixel Peak Extraction:**
   - Column-wise intensity profile $I(y)$ is processed with a center-of-gravity (centroid) algorithm:
     $$y_{centroid} = \frac{\sum (y \cdot [I(y) - T])}{\sum [I(y) - T]}$$
   - This achieves $\pm 0.15$ pixel precision, eliminating quantization noise from coarse integer pixels.
3. **Defect Severity Criteria (DIN 22102 Standard):**
   - **LOW:** $\Delta Z < 2.0\text{ mm}$ (superficial cosmetic abrasion)
   - **MEDIUM:** $2.0\text{ mm} \le \Delta Z < 4.0\text{ mm}$ (top cover degradation)
   - **HIGH:** $4.0\text{ mm} \le \Delta Z < 6.0\text{ mm}$ (critical warning zone)
   - **CRITICAL:** $\Delta Z \ge 6.0\text{ mm}$ or $\ge 5.0\text{ mm}$ on the vulcanized joint (imminent fabric/steel cord pull-out).

---

## 4. Deterministic Marking Controller & Timing

The marking mechanism activates an aerosol paint can using an SG90 servo motor mounted to a rigid nozzle bracket.

- **Non-Reliance on Cloud:** Time-critical marking decisions are calculated locally in embedded C++ on FreeRTOS Core 0/1. The system **never** waits for Gemini cloud inference.
- **Speed-Compensated Transit Delay:**
  $$T_{delay} = \frac{D_{cam \to marker}}{v_{belt}}$$
  *Example:* With $D = 1200\text{ mm}$ ($1.2\text{ m}$) and $v = 0.85\text{ m/s}$, delay $T = 1.412\text{ s}$.
- **Duplicate Lockout:** A 1500ms debounce lockout suppresses repeated spraying of the same physical flaw.
- **Safety Lockout:** Emergency software switch and hardware jumper can disarm the servo instantly.

---

## 5. Predictive Maintenance & Remaining Useful Life (RUL)

The predictive maintenance engine analyzes defect growth across multiple closed-loop belt revolutions:
- **Data Sufficiency Rule:** RUL is **only** estimated when at least 3 unique revolutions are recorded for a tracked defect. If data is sparse, the system outputs an explicit `INSUFFICIENT_DATA` warning.
- **Degradation Rate:**
  $$\frac{\Delta h}{\Delta \text{rev}} = \frac{h_{current} - h_{initial}}{\text{rev}_{current} - \text{rev}_{initial}}$$
- **Estimated Remaining Life:**
  $$\text{Revs}_{remaining} = \frac{h_{critical} - h_{current}}{\text{Degradation Rate}}$$
  $$\text{Hours}_{remaining} = \frac{\text{Revs}_{remaining} \times (60 / \text{RPM})}{3600}$$

---

## 6. Installation & Execution Guide

### Prerequisites
- Node.js 18+ or Python 3.10+
- Arduino IDE with ESP32 Board Support (v2.0.14+)

### A. Flashing ESP32-CAM Firmware
1. Open `firmware/conveyor_monitor.ino` in Arduino IDE.
2. Select Board: **AI Thinker ESP32-CAM**.
3. Set CPU Frequency: **240MHz (WiFi/BT)**, Flash Frequency: **80MHz**, Partition Scheme: **Huge APP (3MB No OTA)**.
4. Update Wi-Fi SSID, password, and backend server IP in `firmware/configuration.h`.
5. Connect an FTDI programmer (GND to GND, 5V to 5V, U0R to TX, U0T to RX, and short GPIO 0 to GND for flashing).
6. Press Reset, click **Upload**, disconnect GPIO 0 from GND, and open Serial Monitor @ 115200 baud.

### B. Launching Python Backend & Tests
```bash
cd conveyor_ai_agent/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run Unit & Integration Tests
pytest ../tests/ -v

# Launch FastAPI Server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### C. Launching Streamlit Dashboard
```bash
cd conveyor_ai_agent/dashboard
streamlit run app.py
```

### D. Running Web Control Center & Digital Twin
```bash
# In the root repository
npm install
npm run dev
# Open browser at http://localhost:3000
```

---

## 7. Step-by-Step Calibration Procedure

1. **Step 1 - Optical Alignment:** Mount the ESP32-CAM perpendicularly 250mm above the belt. Angle the laser diode at $45^\circ$ so the stripe lands across the center of the camera field of view.
2. **Step 2 - Baseline Calibration:** Clear the conveyor belt of all debris. Press the physical calibration button on GPIO 15 or click **Recalibrate Baseline** in the dashboard. The system averages 35 clean frames to zero out baseline belt camber.
3. **Step 3 - Gauge Block Scale Calibration:** Place a certified 5.0mm precision gauge block under the laser stripe. Observe the measured pixel displacement $\Delta Y_{px}$. Set $s_{mm/px} = (5.0 \cdot \sin(45^\circ)) / \Delta Y_{px}$.
4. **Step 4 - Nozzle Distance Calibration:** Measure physical distance along the belt centerline from the camera lens to the spray paint nozzle ($D = 1200\text{ mm}$ default). Save this in the dashboard or firmware configuration.
5. **Step 5 - Dry-Run Servo Test:** Click **Trigger Dry-Run Test** to verify that the SG90 servo arm rotates and depresses the spray valve without binding.
