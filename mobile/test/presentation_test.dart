import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istanbul_planner/main.dart';

void main() {
  testWidgets('Warnings deduplicate for display without mutating response', (
    tester,
  ) async {
    final response = PlanResponse({
      'itinerary': [],
      'summary': {'unknownCostCount': 2, 'routeScore': 42},
      'warnings': [
        {'message': 'Maliyet bilinmiyor; ücretsiz kabul edilmedi.'},
        {'message': 'Maliyet bilinmiyor; ücretsiz kabul edilmedi.'},
      ],
    });
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RoutesPage(plan: response, parserMetadata: null, onBack: () {}),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Bilmen gerekenler'),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.text('• Maliyet bilinmiyor; ücretsiz kabul edilmedi.'),
      findsOneWidget,
    );
    expect(response.warnings.length, 2);
    expect(response.summary['routeScore'], 42);
  });
  testWidgets('Compact preferences remain usable at 320px width', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final form = PlannerForm()..interests = ['history'];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PreferencesPage(
            form: form,
            onCreatePlan: () {},
            loading: false,
            onBack: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Rotayı Oluştur').hitTestable(), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Müze'),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Müze'));
    await tester.pump();
    expect(form.interests, containsAll(['history', 'museum']));
    expect(tester.takeException(), isNull);
  });
}
