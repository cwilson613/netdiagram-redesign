# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Open Network Diagram** is a self-hosted SvelteKit application for visualizing network topology from JSON configuration files. This is a fork of [jcreek/OpenNetworkDiagram](https://github.com/jcreek/OpenNetworkDiagram) with fixes to enable dynamic JSON loading.

## Key Fixes Applied

This fork addresses critical bugs in the upstream project:

1. **API Endpoint** - Created `/src/routes/api/network/+server.ts` to serve network.json from filesystem
2. **NetworkStore** - Fixed `/src/stores/networkStore.ts` to fetch from API instead of using hardcoded example data
3. **Adapter** - Switched from `adapter-auto` to `adapter-node` for Docker deployment

The original project had 260+ lines of hardcoded example data that prevented it from loading actual network topology files.

## Architecture

### Technology Stack
- **Framework**: SvelteKit 2.x with TypeScript
- **Runtime**: Node.js 20 (Alpine Linux in production)
- **Package Manager**: pnpm
- **Deployment**: Docker + Kubernetes

### Directory Structure

```
OpenNetworkDiagram/
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte UI components
│   │   │   └── NetworkDiagram.svelte  # Main visualization component
│   │   ├── types.ts         # TypeScript type definitions
│   │   └── utils/           # Utility functions (pathfinding, etc.)
│   ├── routes/
│   │   ├── api/network/     # API endpoint for serving network.json
│   │   │   └── +server.ts   # GET handler for /api/network
│   │   └── +page.svelte     # Main application page
│   └── stores/
│       └── networkStore.ts  # Svelte store for network data
├── static/                  # Static assets
├── Dockerfile              # Multi-stage Docker build
├── svelte.config.js        # SvelteKit configuration
└── package.json            # Dependencies and scripts
```

## Data Format

The application loads network topology from `/data/network.json`. This file must conform to the following TypeScript schema:

```typescript
interface NetworkData {
  machines: Machine[];      // Physical/virtual servers
  devices: NetworkDevice[]; // Network equipment (routers, switches, APs)
}

interface Machine {
  machineName: string;
  ipAddress: string;
  role: string;
  operatingSystem: string;
  software: {
    vms: VM[];              // Virtual machines if hypervisor
  };
  hardware: {
    cpu: string;
    ram: string;
    networkPorts: number;
    networkPortSpeedGbps?: number;
    gpu?: string;
  };
  ports?: Port[];           // Physical network connections
}

interface NetworkDevice {
  name: string;
  ipAddress: string;
  type: string;
  notes?: string;
  ports?: Port[];
}

interface Port {
  portName: string;
  speedGbps?: number;
  connectedTo?: string;     // Reference: "DeviceName-PortName"
}

interface VM {
  name: string;
  role: string;
  ipAddress: string;
}
```

### Example network.json

```json
{
  "machines": [
    {
      "machineName": "server1",
      "ipAddress": "192.168.0.10",
      "role": "Application Server",
      "operatingSystem": "Ubuntu 22.04",
      "software": { "vms": [] },
      "hardware": {
        "cpu": "Intel Xeon E5",
        "ram": "32GB",
        "networkPorts": 2,
        "networkPortSpeedGbps": 10
      }
    }
  ],
  "devices": [
    {
      "name": "router1",
      "ipAddress": "192.168.0.1",
      "type": "Router",
      "notes": "Main gateway"
    }
  ]
}
```

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Run dev server (http://localhost:5173)
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

### Important Files to Know

| File | Purpose | When to Modify |
|------|---------|----------------|
| `src/routes/api/network/+server.ts` | Serves network.json from `/data` | Change file path or add validation |
| `src/stores/networkStore.ts` | Manages network data state | Add data transformations or caching |
| `src/lib/components/NetworkDiagram.svelte` | Main visualization component | Customize UI, add features |
| `src/lib/types.ts` | TypeScript type definitions | Extend data schema |
| `svelte.config.js` | SvelteKit configuration | Change build adapter or settings |
| `Dockerfile` | Docker build configuration | Modify build process or runtime |

### Key Concepts

**A* Pathfinding**: The application uses A* algorithm (`src/lib/utils/pathfinding.ts`) to route connection lines around nodes. This creates intelligent, non-overlapping connection paths in the visualization.

**Port Connections**: Define connections using the `connectedTo` field in Port objects. Format: `"TargetMachineName-PortName"`. Example: `"Router-LAN1"` connects to the LAN1 port on a device named "Router".

**Color Coding**: Connections are color-coded by speed:
- Blue: 1 GbE
- Green: 2.5 GbE
- Orange: 10 GbE

## Docker Deployment

### Building

```bash
# Build for linux/amd64 (typical for servers)
docker buildx build --platform linux/amd64 -t network-diagram:latest .

# Build and load for local testing
docker buildx build --platform linux/amd64 -t network-diagram:latest --load .
```

### Running

```bash
# Run with volume mount for network.json
docker run -d \
  -p 3000:3000 \
  -v /path/to/network.json:/data/network.json \
  network-diagram:latest
```

**Critical**: The `/data/network.json` file must exist or the app will show an empty diagram. The API endpoint returns an empty structure (`{ machines: [], devices: [] }`) if the file is missing.

## Kubernetes Deployment

### Standard Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: network-diagram
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: network-diagram
        image: cwilson613/open-network-diagram:fixed
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: network-data
          mountPath: /data
      volumes:
      - name: network-data
        configMap:
          name: network-json
```

### ConfigMap for network.json

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: network-json
data:
  network.json: |
    {
      "machines": [...],
      "devices": [...]
    }
```

Alternatively, use `kubectl cp` to copy network.json into the pod:

```bash
kubectl cp network.json default/pod-name:/data/network.json
```

## Production Deployment Notes

This fork is deployed at:
- **Repository**: https://github.com/cwilson613/OpenNetworkDiagram
- **Docker Image**: `cwilson613/open-network-diagram:fixed`
- **Production URL**: https://netdiagram.vanderlyn.house
- **Network**: 192.168.0.0/24 (vanderlyn.local/vanderlyn.house)

### Current Production Setup
- **Platform**: K3s on Debian
- **Ingress**: Traefik with automatic HTTPS redirect
- **TLS**: Let's Encrypt via cert-manager (DNS-01 challenge with Cloudflare)
- **LoadBalancer**: MetalLB (192.168.0.101-110 pool)
- **Data Source**: `/data/network.json` copied via kubectl

## Common Tasks

### Adding New Machines/Devices

1. Edit your `network.json` file
2. Add new Machine or NetworkDevice objects following the schema
3. Copy updated file to pod: `kubectl cp network.json pod-name:/data/network.json`
4. Refresh the browser (app auto-fetches on load)

### Adding Port Connections

1. Add `ports` array to Machine/Device objects
2. Reference target ports using `connectedTo: "MachineName-PortName"`
3. The visualization will automatically draw connection lines

### Customizing the UI

**Main visualization**: Edit `src/lib/components/NetworkDiagram.svelte`
**Styling**: Uses Tailwind CSS - modify classes inline or extend `tailwind.config.js`
**Layout algorithm**: Adjust in NetworkDiagram.svelte's positioning logic

## Troubleshooting

### Empty Diagram Displayed

**Cause**: network.json file not found at `/data/network.json`

**Fix**:
- Check volume mount in Docker/K8s
- Verify file exists: `kubectl exec pod-name -- ls -la /data/`
- Check API logs: `kubectl logs pod-name`

### Data Not Updating

**Cause**: Browser cache or file not refreshed

**Fix**:
- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
- Verify file content: `kubectl exec pod-name -- cat /data/network.json`
- Check browser console for fetch errors

### Build Failures

**Common issues**:
- Missing `@sveltejs/adapter-node` dependency - run `pnpm install`
- TypeScript errors - check `src/lib/types.ts` matches your data
- Vite build errors - clear `.svelte-kit` and rebuild

### Port Connection Lines Not Showing

**Causes**:
- Invalid `connectedTo` reference (typo in machine/port name)
- Missing port definitions on target machine
- A* pathfinding couldn't find valid route

**Fix**:
- Check console for connection warnings
- Verify both source and target ports exist
- Ensure machine names match exactly (case-sensitive)

## Contributing Back to Upstream

If you fix bugs or add features that benefit the broader project:

1. Create a branch from `master`
2. Make your changes with clear commit messages
3. Test thoroughly (dev + production builds)
4. Submit PR to upstream: https://github.com/jcreek/OpenNetworkDiagram

**Upstream Status**: As of this fork (Nov 2025), the upstream project has the API loading bug. Check if it's been fixed before submitting duplicate PRs.

## Dependencies

### Runtime Dependencies
- `leader-line@1.0.8` - SVG line drawing for connections

### Development Dependencies
- `@sveltejs/kit@2.20.4` - SvelteKit framework
- `@sveltejs/adapter-node@5.4.0` - Node.js adapter for production
- `svelte@5.25.8` - Svelte 5 framework
- `tailwindcss@4.1.3` - Utility-first CSS
- `typescript@5.8.3` - Type safety
- `vite@6.2.5` - Build tool

## Performance Considerations

- **Large Networks**: 50+ nodes may experience slow rendering
- **A* Pathfinding**: Can be CPU-intensive with many connections
- **Memory**: Card-based layout scales well, but consider virtualization for 100+ nodes

## Security Notes

- No authentication built-in - deploy behind reverse proxy with auth if needed
- network.json is publicly accessible via `/api/network` endpoint
- No input validation on JSON data - ensure trusted sources only
- File system access limited to `/data/network.json` path only

## Future Enhancements (Ideas)

- [ ] Real-time JSON editing in UI
- [ ] File upload interface (eliminate kubectl cp workflow)
- [ ] Export diagram to PNG/SVG
- [ ] Drag-and-drop node positioning with save state
- [ ] SNMP/CDP auto-discovery integration
- [ ] Dark mode toggle
- [ ] Search/filter nodes by name, IP, role
- [ ] Zoom controls and minimap
- [ ] Collapsible VM lists on hypervisors

## Additional Resources

- **SvelteKit Docs**: https://svelte.dev/docs/kit
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Leader Line**: https://anseki.github.io/leader-line/
- **Original Project**: https://github.com/jcreek/OpenNetworkDiagram
