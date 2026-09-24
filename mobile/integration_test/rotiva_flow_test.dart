import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:integration_test/integration_test.dart';
import 'package:istanbul_planner/main.dart' as app;
import 'package:istanbul_planner/route_preview.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Live Gemini demo -> preferences -> real map -> back', (
    tester,
  ) async {
    app.main();
    await tester.pumpAndSettle();
    await binding.convertFlutterSurfaceToImage();
    await tester.enterText(
      find.byType(TextField).first,
      "Sultanahmet'ta 5 saatim var. Tarihi yerleri ve müzeleri seviyorum. Çok yürümek istemiyorum. Bütçem 1000 TL. Topkapı'da Harem'i görmek istiyorum.",
    );
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.ensureVisible(find.text('Rotamı Planla'));
    await tester.tap(find.text('Rotamı Planla'));
    for (var i = 0; i < 120; i++) {
      await tester.pump(const Duration(seconds: 1));
      if (find.byType(app.PreferencesPage).evaluate().isNotEmpty &&
          tester
              .widget<app.PreferencesPage>(find.byType(app.PreferencesPage))
              .form
              .activities
              .isNotEmpty) {
        break;
      }
      if (find.byType(app.ErrorPage).evaluate().isNotEmpty) {
        fail(tester.widget<app.ErrorPage>(find.byType(app.ErrorPage)).message);
      }
    }
    final prefs = tester.widget<app.PreferencesPage>(
      find.byType(app.PreferencesPage),
    );
    await tester.pumpAndSettle();
    await binding.takeScreenshot('preferences');
    // Live interpretation is nondeterministic. If it omits Harem, select the
    // actual canonical activity through the UI, without changing the backend.
    if (!prefs.form.selected.any((id) => id.contains('harem'))) {
      final harem = prefs.form.activities
          .expand((place) => place.activities)
          .firstWhere(
            (activity) => activity.name.toLowerCase().contains('harem'),
          );
      final label = find.text('${harem.name} · ${harem.durationMinutes} dk');
      for (var i = 0; i < 30 && label.hitTestable().evaluate().isEmpty; i++) {
        await tester.drag(find.byType(ListView).first, const Offset(0, -220));
        await tester.pumpAndSettle();
      }
      expect(label.hitTestable(), findsOneWidget);
      await tester.tap(label);
      await tester.pump();
    }
    expect(prefs.form.selected.any((id) => id.contains('harem')), isTrue);
    final request = jsonEncode(prefs.form.toRequest());
    await tester.tap(find.text('Rotayı Oluştur'));
    for (var i = 0; i < 60; i++) {
      await tester.pump(const Duration(seconds: 1));
      if (find.byType(app.RoutesPage).evaluate().isNotEmpty) {
        break;
      }
      if (find.byType(app.ErrorPage).evaluate().isNotEmpty) {
        fail(tester.widget<app.ErrorPage>(find.byType(app.ErrorPage)).message);
      }
    }
    final page = tester.widget<app.RoutesPage>(find.byType(app.RoutesPage));
    final plan = page.plan!;
    expect(plan.itinerary, isNotEmpty);
    expect(plan.summary['routeScore'], isA<num>());
    final catalog =
        jsonDecode(
              await rootBundle.loadString(
                'assets/data/verified_coordinates.json',
              ),
            )
            as Map;
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(seconds: 1));
    }
    final markers = tester
        .widget<MarkerLayer>(find.byType(MarkerLayer))
        .markers;
    for (final marker in markers) {
      expect(
        plan.itinerary.any(
          (stop) => verifiedPoint(stop, plan.region, catalog) == marker.point,
        ),
        isTrue,
      );
    }
    expect(markers, isNotEmpty);
    final lines = tester
        .widget<PolylineLayer>(find.byType(PolylineLayer))
        .polylines;
    for (final line in lines) {
      expect(
        plan.itinerary.any(
          (stop) =>
              verifiedPoint(stop, plan.region, catalog) == line.points.first,
        ),
        isTrue,
      );
      expect(
        plan.itinerary.any(
          (stop) =>
              verifiedPoint(stop, plan.region, catalog) == line.points.last,
        ),
        isTrue,
      );
    }
    expect(find.text('Maliyet: Bilinmiyor'), findsWidgets);
    expect(tester.takeException(), isNull);
    await binding.takeScreenshot('route-result');
    await tester.tap(find.byTooltip('Geri'));
    await tester.pumpAndSettle();
    expect(
      jsonEncode(
        tester
            .widget<app.PreferencesPage>(find.byType(app.PreferencesPage))
            .form
            .toRequest(),
      ),
      request,
    );
    for (
      var i = 0;
      i < 30 && find.byTooltip('Geri').hitTestable().evaluate().isEmpty;
      i++
    ) {
      await tester.drag(find.byType(ListView).first, const Offset(0, 300));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.byTooltip('Geri'));
    await tester.pumpAndSettle();
    expect(find.byType(app.DiscoverPage), findsOneWidget);
  });
}
