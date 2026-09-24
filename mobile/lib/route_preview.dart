import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Maps canonical region/place IDs to an audited snapshot, never names or guesses.
LatLng? verifiedPoint(Map<String, dynamic> stop, String? region, Map catalog) {
  final record = (catalog['regions'] as Map?)?[region]?[stop['placeId']];
  if (record is! Map || record['geocodeStatus'] != 'verified') return null;
  final coordinate = record['coordinates'];
  if (coordinate is! Map) return null;
  final lat = coordinate['lat'];
  final lng = coordinate['lng'];
  if (lat is! num ||
      lng is! num ||
      !lat.isFinite ||
      !lng.isFinite ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180) {
    return null;
  }
  return LatLng(lat.toDouble(), lng.toDouble());
}

class RoutePreview extends StatefulWidget {
  const RoutePreview({super.key, required this.stops, required this.region});
  final List<Map<String, dynamic>> stops;
  final String? region;
  @override
  State<RoutePreview> createState() => _RoutePreviewState();
}

class _RoutePreviewState extends State<RoutePreview> {
  static final Future<Map> _catalog = rootBundle
      .loadString('assets/data/verified_coordinates.json')
      .then((text) => jsonDecode(text) as Map);
  bool _tileFailed = false;

  @override
  Widget build(BuildContext context) => FutureBuilder<Map>(
    future: _catalog,
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return SizedBox(
          height: 180,
          child: Center(
            child: Text(
              snapshot.hasError
                  ? 'Harita konumları yüklenemedi.'
                  : 'Harita hazırlanıyor…',
            ),
          ),
        );
      }
      final points = widget.stops
          .map((stop) => verifiedPoint(stop, widget.region, snapshot.data!))
          .toList();
      final valid = points.whereType<LatLng>().toList();
      if (valid.isEmpty) {
        return Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFEAF0E6),
            borderRadius: BorderRadius.circular(18),
          ),
          child: const Text(
            'Bu rotanın durakları için doğrulanmış harita konumu bulunamadı. Rota detaylarını aşağıda görebilirsin.',
          ),
        );
      }
      // Keep original sequence numbers; do not bridge across missing coordinates.
      final lines = <Polyline>[];
      for (var i = 1; i < points.length; i++) {
        if (points[i - 1] != null && points[i] != null) {
          lines.add(
            Polyline(
              points: [points[i - 1]!, points[i]!],
              color: const Color(0xFFC66B4B),
              strokeWidth: 3,
            ),
          );
        }
      }
      final groups = <String, List<int>>{};
      for (var i = 0; i < points.length; i++) {
        final p = points[i];
        if (p != null) {
          groups.putIfAbsent('${p.latitude},${p.longitude}', () => []).add(i);
        }
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(
              height: 215,
              child: FlutterMap(
                key: ValueKey(points.map((p) => p?.toString()).join('|')),
                options: MapOptions(
                  initialCenter: valid.first,
                  initialZoom: 15,
                  initialCameraFit: valid.length > 1
                      ? CameraFit.bounds(
                          bounds: LatLngBounds.fromPoints(valid),
                          padding: const EdgeInsets.all(36),
                          maxZoom: 16,
                        )
                      : null,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.none,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.example.istanbul_planner',
                    maxNativeZoom: 19,
                    errorTileCallback: (_, _, _) {
                      if (!_tileFailed && mounted) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) setState(() => _tileFailed = true);
                        });
                      }
                    },
                  ),
                  PolylineLayer(polylines: lines),
                  MarkerLayer(
                    markers: groups.values
                        .map(
                          (indices) => Marker(
                            point: points[indices.first]!,
                            width: indices.length > 1 ? 66 : 32,
                            height: 32,
                            child: Semantics(
                              label: indices
                                  .map(
                                    (i) =>
                                        '${i + 1}. durak: ${widget.stops[i]['placeName']}',
                                  )
                                  .join(', '),
                              child: Container(
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFC66B4B),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 2,
                                  ),
                                ),
                                child: Text(
                                  indices.map((i) => '${i + 1}').join(' · '),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const Align(
                    alignment: Alignment.bottomRight,
                    child: ColoredBox(
                      color: Colors.white,
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 3,
                        ),
                        child: Text(
                          '© OpenStreetMap contributors',
                          style: TextStyle(
                            fontSize: 10,
                            color: Color(0xFF173B32),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 5),
          Text(
            _tileFailed
                ? 'Harita zemini yüklenemedi. Konum işaretleri gerçek koordinatları gösterir.'
                : '${valid.length}/${points.length} durak haritada · Çizgi durak sırasını gösterir, yürüyüş yolu değildir.',
            style: const TextStyle(fontSize: 10, color: Color(0xFF53665B)),
          ),
        ],
      );
    },
  );
}
