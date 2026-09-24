import 'package:flutter_test/flutter_test.dart';
import 'package:istanbul_planner/route_preview.dart';

void main() {
  test(
    'Coordinates require region, canonical ID, verified status and valid range',
    () {
      final catalog = {
        'regions': {
          'r': {
            'id': {
              'geocodeStatus': 'verified',
              'coordinates': {'lat': 41.0, 'lng': 29.0},
            },
          },
        },
      };
      expect(verifiedPoint({'placeId': 'id'}, 'r', catalog)?.latitude, 41);
      expect(verifiedPoint({'placeId': 'id'}, 'other', catalog), isNull);
      expect(verifiedPoint({'placeName': 'id'}, 'r', catalog), isNull);
      catalog['regions']!['r']!['id']!['geocodeStatus'] = 'unknown';
      expect(verifiedPoint({'placeId': 'id'}, 'r', catalog), isNull);
      catalog['regions']!['r']!['id']!['geocodeStatus'] = 'verified';
      catalog['regions']!['r']!['id']!['coordinates'] = {
        'lat': 91.0,
        'lng': 29.0,
      };
      expect(verifiedPoint({'placeId': 'id'}, 'r', catalog), isNull);
    },
  );
}
