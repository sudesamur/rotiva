import 'dart:convert';

import 'package:flutter/material.dart';
import 'route_preview.dart';
import 'package:http/http.dart' as http;

const rotivaForest = Color(0xFF173B32);
const rotivaSage = Color(0xFFB9D7C3);
const rotivaTerracotta = Color(0xFFC66B4B);
const rotivaCream = Color(0xFFF7F3EA);
const rotivaInk = Color(0xFF20352E);
const rotivaMuted = Color(0xFF718078);
const rotivaLine = Color(0xFFDDE8DE);

void main() => runApp(const RotivaApp());

class RotivaApp extends StatelessWidget {
  const RotivaApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: rotivaCream,
      colorScheme: ColorScheme.fromSeed(
        seedColor: rotivaForest,
        brightness: Brightness.light,
        primary: rotivaForest,
        secondary: rotivaSage,
        surface: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: rotivaCream,
        foregroundColor: rotivaInk,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(18)),
          borderSide: BorderSide(color: rotivaLine),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(18)),
          borderSide: BorderSide(color: rotivaLine),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(18)),
          borderSide: BorderSide(color: rotivaForest, width: 1.5),
        ),
      ),
      cardTheme: const CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(22)),
          side: BorderSide(color: rotivaLine),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: rotivaForest,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(56),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(17)),
          ),
        ),
      ),
    ),
    home: const PlannerShell(),
  );
}

class PlannerShell extends StatefulWidget {
  const PlannerShell({super.key});
  @override
  State<PlannerShell> createState() => _PlannerShellState();
}

class _PlannerShellState extends State<PlannerShell> {
  int index = 0;
  final PlannerApi api = PlannerApi();
  final PlannerForm form = PlannerForm();
  PlanResponse? plan;
  String? parserMetadata;
  String? errorMessage;
  bool interpreting = false;
  bool planning = false;

  Future<void> interpret(String text) async {
    setState(() {
      interpreting = true;
      errorMessage = null;
    });
    try {
      final response = await api.interpret(text);
      form.applyInterpretation(response);
      setState(() {
        parserMetadata = jsonEncode(response.parserMetadata);
        index = 1;
      });
      await form.loadActivities(api, response.requestedActivities);
      if (mounted) setState(() {});
    } catch (error) {
      setState(() => errorMessage = error.toString());
    } finally {
      if (mounted) setState(() => interpreting = false);
    }
  }

  Future<void> createPlan() async {
    setState(() {
      planning = true;
      errorMessage = null;
    });
    try {
      final response = await api.plan(form.toRequest());
      setState(() {
        plan = response;
        index = 2;
      });
    } catch (error) {
      setState(() => errorMessage = error.toString());
    } finally {
      if (mounted) setState(() => planning = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: index == 0,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop && index > 0) setState(() => index -= 1);
    },
    child: Scaffold(
      body: SafeArea(
        child: errorMessage == null
            ? [
                DiscoverPage(onInterpret: interpret, loading: interpreting),
                PreferencesPage(
                  form: form,
                  onCreatePlan: createPlan,
                  loading: planning,
                  onBack: () => setState(() => index = 0),
                ),
                RoutesPage(
                  plan: plan,
                  parserMetadata: parserMetadata,
                  onBack: () => setState(() => index = 1),
                ),
              ][index]
            : ErrorPage(
                message: errorMessage!,
                onDismiss: () => setState(() => errorMessage = null),
              ),
      ),
    ),
  );
}

class RotivaMark extends StatelessWidget {
  const RotivaMark({super.key, this.compact = false});
  final bool compact;
  @override
  Widget build(BuildContext context) {
    if (compact) {
      return const Text(
        'ROTIVA',
        style: TextStyle(
          color: rotivaForest,
          fontSize: 16,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.8,
        ),
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 82,
          height: 82,
          child: CustomPaint(painter: _RotivaLogoPainter()),
        ),
        const SizedBox(height: 12),
        const Text(
          'ROTIVA',
          style: TextStyle(
            color: rotivaForest,
            fontSize: 20,
            fontWeight: FontWeight.w900,
            letterSpacing: 3.2,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Senin günün, senin rotan.',
          style: TextStyle(color: rotivaMuted, fontSize: 12),
        ),
      ],
    );
  }
}

class RotivaLogoAsset extends StatelessWidget {
  const RotivaLogoAsset({super.key});
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 214,
    height: 146,
    child: ClipRect(
      child: Transform.scale(
        scale: 1.18,
        child: Image.asset(
          'assets/images/rotiva_logo.png',
          fit: BoxFit.contain,
        ),
      ),
    ),
  );
}

class _RotivaLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final ring = Paint()
      ..color = rotivaForest
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.5
      ..strokeCap = StrokeCap.round;
    final route = Paint()
      ..color = rotivaSage
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, size.width * .36, ring);
    final path = Path()
      ..moveTo(size.width * .34, size.height * .28)
      ..cubicTo(
        size.width * .62,
        size.height * .18,
        size.width * .64,
        size.height * .52,
        size.width * .42,
        size.height * .62,
      )
      ..cubicTo(
        size.width * .28,
        size.height * .69,
        size.width * .57,
        size.height * .78,
        size.width * .69,
        size.height * .66,
      );
    canvas.drawPath(path, route);
    final pin = Paint()..color = rotivaTerracotta;
    canvas.drawCircle(
      Offset(size.width * .34, size.height * .28),
      size.width * .065,
      pin,
    );
    final dashes = Paint()
      ..color = rotivaTerracotta
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var index = 0; index < 3; index++) {
      final x = size.width * (.42 + index * .1);
      canvas.drawLine(
        Offset(x, size.height * .63 - index * 3),
        Offset(x + size.width * .045, size.height * .61 - index * 3),
        dashes,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class StepHeader extends StatelessWidget {
  const StepHeader({super.key, required this.current});
  final int current;
  @override
  Widget build(BuildContext context) => Row(
    children: List.generate(3, (index) {
      final active = index <= current;
      return Expanded(
        child: Row(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: active ? rotivaForest : rotivaLine,
              child: Text(
                index < current ? '✓' : '${index + 1}',
                style: TextStyle(
                  color: active ? Colors.white : rotivaMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            if (index < 2)
              Expanded(
                child: Container(
                  height: 2,
                  margin: const EdgeInsets.symmetric(horizontal: 7),
                  color: index < current ? rotivaForest : rotivaLine,
                ),
              ),
          ],
        ),
      );
    }),
  );
}

class DiscoverPage extends StatefulWidget {
  const DiscoverPage({
    super.key,
    required this.onInterpret,
    required this.loading,
  });
  final ValueChanged<String> onInterpret;
  final bool loading;
  @override
  State<DiscoverPage> createState() => _DiscoverPageState();
}

class _DiscoverPageState extends State<DiscoverPage> {
  final promptKey = GlobalKey<_PromptFieldState>();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
    children: [
      const Center(child: RotivaLogoAsset()),
      const SizedBox(height: 20),
      const Text(
        'Bugün nasıl bir gün\ngeçirmek istiyorsun?',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: rotivaForest,
          fontSize: 30,
          height: 1.1,
          fontWeight: FontWeight.w900,
        ),
      ),
      const SizedBox(height: 12),
      const Text(
        "Rotiva'ya anlat, sana uygun rotayı oluştursun.",
        textAlign: TextAlign.center,
        style: TextStyle(color: rotivaMuted, fontSize: 14),
      ),
      const SizedBox(height: 24),
      _PromptField(
        key: promptKey,
        onSubmit: widget.onInterpret,
        loading: widget.loading,
      ),
      const SizedBox(height: 24),
      const Text(
        'Örnek fikirler',
        style: TextStyle(
          color: rotivaInk,
          fontSize: 17,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 10),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: const [
          _IdeaChip(Icons.account_balance, 'Tarih & Kültür', accent: true),
          _IdeaChip(Icons.local_cafe, 'Kahve & Yemek'),
          _IdeaChip(Icons.park, 'Doğa & Manzara'),
          _IdeaChip(Icons.directions_walk, 'Az Yürüyüş'),
          _IdeaChip(Icons.wb_sunny, 'Tüm Gün'),
        ],
      ),
      const SizedBox(height: 20),
      SizedBox(
        height: 60,
        width: double.infinity,
        child: FilledButton(
          onPressed: widget.loading
              ? null
              : () => promptKey.currentState?.submit(),
          style: FilledButton.styleFrom(shape: const StadiumBorder()),
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Text('Rotamı Planla', style: TextStyle(fontSize: 18)),
              Align(
                alignment: Alignment.centerRight,
                child: widget.loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.arrow_forward, size: 28),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 20),
      const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.info_outline, size: 16, color: rotivaMuted),
          SizedBox(width: 6),
          Text(
            'Tercihlerini sonraki adımda düzenleyebilirsin.',
            style: TextStyle(color: rotivaMuted, fontSize: 12),
          ),
        ],
      ),
      const SizedBox(height: 32),
      const _TravelIllustration(),
    ],
  );
}

class _IdeaChip extends StatelessWidget {
  const _IdeaChip(this.icon, this.label, {this.accent = false});
  final IconData icon;
  final String label;
  final bool accent;
  @override
  Widget build(BuildContext context) => Chip(
    avatar: Icon(
      icon,
      size: 17,
      color: accent ? rotivaTerracotta : rotivaForest,
    ),
    label: Text(label),
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
    backgroundColor: accent ? const Color(0xFFFFE7DC) : const Color(0xFFEAF2EA),
    side: BorderSide.none,
    shape: const StadiumBorder(),
    labelStyle: const TextStyle(
      color: rotivaInk,
      fontSize: 12.5,
      fontWeight: FontWeight.w700,
    ),
  );
}

class _TravelIllustration extends StatelessWidget {
  const _TravelIllustration();
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 214,
    child: Stack(
      children: [
        Positioned.fill(
          child: CustomPaint(painter: _TravelIllustrationPainter()),
        ),
        Positioned(
          right: 5,
          top: 52,
          child: Transform.rotate(
            angle: -0.06,
            child: const Text(
              'YENİ YERLER\nYENİ HİKAYELER',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 8,
                height: 1.25,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),
        const Positioned(
          left: 18,
          top: 30,
          child: Text(
            'Keşfet\nPlanla\nYaşa',
            style: TextStyle(
              color: rotivaForest,
              fontSize: 11,
              height: 1.3,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    ),
  );
}

class _TravelIllustrationPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final hill = Paint()..color = rotivaSage;
    final paleHill = Paint()..color = const Color(0xFFDDEBDB);
    final sun = Paint()..color = rotivaTerracotta;
    final road = Paint()
      ..color = rotivaCream
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;
    final dash = Paint()
      ..color = rotivaTerracotta
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(Offset(size.width * .82, size.height * .2), 18, sun);
    final back = Path()
      ..moveTo(0, size.height * .72)
      ..quadraticBezierTo(
        size.width * .2,
        size.height * .36,
        size.width * .42,
        size.height * .68,
      )
      ..quadraticBezierTo(
        size.width * .66,
        size.height * .98,
        size.width,
        size.height * .52,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(back, paleHill);
    final front = Path()
      ..moveTo(0, size.height * .82)
      ..quadraticBezierTo(
        size.width * .22,
        size.height * .58,
        size.width * .46,
        size.height * .8,
      )
      ..quadraticBezierTo(
        size.width * .7,
        size.height * 1.02,
        size.width,
        size.height * .7,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(front, hill);
    final route = Path()
      ..moveTo(size.width * .08, size.height * .88)
      ..cubicTo(
        size.width * .32,
        size.height * .62,
        size.width * .54,
        size.height * .96,
        size.width * .72,
        size.height * .7,
      )
      ..cubicTo(
        size.width * .8,
        size.height * .58,
        size.width * .82,
        size.height * .48,
        size.width * .8,
        size.height * .34,
      );
    canvas.drawPath(route, road);
    for (var index = 0; index < 4; index++) {
      final y = size.height * (.79 - index * .1);
      canvas.drawLine(
        Offset(size.width * (.72 + index * .02), y),
        Offset(size.width * (.75 + index * .02), y - 4),
        dash,
      );
    }
    final sign = Paint()..color = rotivaForest;
    final pole = Paint()
      ..color = rotivaForest
      ..strokeWidth = 3;
    canvas.drawLine(
      Offset(size.width * .87, size.height * .72),
      Offset(size.width * .87, size.height * .42),
      pole,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          size.width * .77,
          size.height * .3,
          size.width * .26,
          size.height * .2,
        ),
        const Radius.circular(5),
      ),
      sign,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class PreferencesPage extends StatefulWidget {
  const PreferencesPage({
    super.key,
    required this.form,
    required this.onCreatePlan,
    required this.loading,
    required this.onBack,
  });
  final PlannerForm form;
  final VoidCallback onCreatePlan;
  final bool loading;
  final VoidCallback onBack;
  @override
  State<PreferencesPage> createState() => _PreferencesPageState();
}

class _PreferencesPageState extends State<PreferencesPage> {
  @override
  Widget build(BuildContext context) {
    final form = widget.form;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 22),
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: widget.onBack,
                    icon: const Icon(Icons.arrow_back),
                    tooltip: 'Geri',
                  ),
                  const RotivaMark(compact: true),
                ],
              ),
              const SizedBox(height: 18),
              const _PreferencesSteps(),
              const SizedBox(height: 18),
              Text(
                'Rotanı kişiselleştir',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: rotivaForest,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'Lora',
                  fontSize: 29,
                ),
              ),
              const SizedBox(height: 7),
              const Text(
                'Daha iyi bir rota için tercihlerini kontrol edebilirsin.',
                style: TextStyle(color: rotivaMuted, height: 1.5),
              ),
              const SizedBox(height: 14),
              _PreferenceCard(
                title: 'Keşif Bölgen',
                child: Text(
                  form.regionLabel,
                  style: const TextStyle(fontSize: 13, color: rotivaMuted),
                ),
              ),
              const SizedBox(height: 10),
              _PreferenceCard(
                title: 'Gezi Süresi',
                child: TextFormField(
                  initialValue: '${form.availableMinutes}',
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 14),
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 10,
                    ),
                    suffixText: 'dakika',
                    prefixIcon: Icon(Icons.schedule_outlined),
                  ),
                  onChanged: (value) => form.availableMinutes =
                      int.tryParse(value) ?? form.availableMinutes,
                ),
              ),
              const SizedBox(height: 10),
              _PreferenceCard(
                title: 'Bütçe',
                child: TextFormField(
                  initialValue: form.budgetTRY > 0 ? '${form.budgetTRY}' : '',
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 14),
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 10,
                    ),
                    hintText: 'Bilinmiyor',
                    suffixText: 'TL',
                    prefixIcon: Icon(Icons.account_balance_wallet_outlined),
                  ),
                  onChanged: (value) =>
                      form.budgetTRY = int.tryParse(value) ?? form.budgetTRY,
                ),
              ),
              const SizedBox(height: 10),
              _PreferenceCard(
                title: 'İlgi Alanların',
                child: Wrap(
                  spacing: 5,
                  runSpacing: 5,
                  children:
                      [
                            'history',
                            'museum',
                            'culture',
                            'coffee',
                            'food',
                            'nature',
                            'shopping',
                            'view',
                          ]
                          .map(
                            (item) => ChoiceChip(
                              label: Text(interestLabel(item)),
                              selected: form.interests.contains(item),
                              onSelected: (selected) => setState(() {
                                if (selected) {
                                  form.interests.add(item);
                                } else {
                                  form.interests.remove(item);
                                }
                              }),
                              selectedColor: rotivaForest,
                              backgroundColor: const Color(0xFFF0F1E9),
                              labelStyle: TextStyle(
                                fontSize: 12,
                                color: form.interests.contains(item)
                                    ? Colors.white
                                    : rotivaForest,
                              ),
                              showCheckmark: false,
                              side: BorderSide.none,
                              shape: const StadiumBorder(),
                              visualDensity: VisualDensity.compact,
                              materialTapTargetSize:
                                  MaterialTapTargetSize.shrinkWrap,
                            ),
                          )
                          .toList(),
                ),
              ),
              const SizedBox(height: 10),
              _PreferenceCard(
                title: 'Yürüyüş Tercihin',
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: ['low', 'normal', 'high']
                      .map(
                        (value) => ChoiceChip(
                          label: Text(walkingLabel(value)),
                          selected: form.walkingPreference == value,
                          onSelected: (_) =>
                              setState(() => form.walkingPreference = value),
                          selectedColor: rotivaForest,
                          backgroundColor: const Color(0xFFF0F1E9),
                          labelStyle: TextStyle(
                            fontSize: 12,
                            color: form.walkingPreference == value
                                ? Colors.white
                                : rotivaForest,
                          ),
                          showCheckmark: false,
                          side: BorderSide.none,
                          shape: const StadiumBorder(),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                        ),
                      )
                      .toList(),
                ),
              ),
              const SizedBox(height: 10),
              _PreferenceCard(
                title: 'Aktivitelerini Seç',
                child: form.activities.isNotEmpty
                    ? Column(
                        spacing: 12,
                        children: form.activities
                            .map(
                              (place) => Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                spacing: 5,
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 4,
                                    ),
                                    child: Text(
                                      place.name,
                                      style: const TextStyle(
                                        color: rotivaForest,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  ...place.activities.map(
                                    (activity) => CheckboxListTile(
                                      dense: true,
                                      visualDensity: VisualDensity.compact,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 0,
                                          ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(18),
                                        side: const BorderSide(
                                          color: rotivaLine,
                                        ),
                                      ),
                                      tileColor: const Color(0xFFFAFBF8),
                                      selectedTileColor: const Color(
                                        0xFFEAF2EA,
                                      ),
                                      selected: form.isSelected(
                                        place.id,
                                        activity.activityId,
                                      ),
                                      controlAffinity:
                                          ListTileControlAffinity.leading,
                                      checkboxShape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(5),
                                      ),
                                      activeColor: rotivaForest,
                                      title: Text(
                                        '${activity.name} · ${activity.durationMinutes} dk',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: rotivaInk,
                                        ),
                                      ),
                                      value: form.isSelected(
                                        place.id,
                                        activity.activityId,
                                      ),
                                      onChanged: (_) => setState(
                                        () => form.toggleActivity(
                                          place.id,
                                          activity.activityId,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            )
                            .toList(),
                      )
                    : const Text('Aktiviteler yükleniyor...'),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 14),
          child: SizedBox(
            width: double.infinity,
            height: 54,
            child: FilledButton(
              onPressed: widget.loading ? null : widget.onCreatePlan,
              style: FilledButton.styleFrom(
                shape: const StadiumBorder(),
                backgroundColor: rotivaForest,
                disabledBackgroundColor: rotivaForest.withValues(alpha: .65),
                disabledForegroundColor: Colors.white,
              ),
              child: Row(
                children: [
                  const SizedBox(width: 24),
                  Expanded(
                    child: Text(
                      widget.loading
                          ? 'Rotan hazırlanıyor...'
                          : 'Rotayı Oluştur',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  widget.loading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                            semanticsLabel: 'Rotan hazırlanıyor',
                          ),
                        )
                      : const Icon(Icons.arrow_forward_rounded),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PreferenceCard extends StatelessWidget {
  const _PreferenceCard({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: rotivaLine),
      boxShadow: const [
        BoxShadow(
          color: Color(0x08173B32),
          blurRadius: 18,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: rotivaForest,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    ),
  );
}

class _PreferencesSteps extends StatelessWidget {
  const _PreferencesSteps();
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: List.generate(3, (index) {
      const labels = ['İsteğini Anladık', 'Tercihlerin', 'Rotan Hazır'];
      const color = rotivaForest;
      return Expanded(
        child: Semantics(
          label: '${index + 1}. adım: ${labels[index]}',
          selected: index == 1,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 2,
                      color: index == 0 ? Colors.transparent : rotivaLine,
                    ),
                  ),
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: index == 2 ? rotivaLine : color,
                    child: index == 0
                        ? const Icon(
                            Icons.check_rounded,
                            size: 18,
                            color: Colors.white,
                          )
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: index == 2 ? rotivaMuted : Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                  Expanded(
                    child: Container(
                      height: 2,
                      color: index == 2 ? Colors.transparent : rotivaLine,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 9),
              Text(
                labels[index],
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  height: 1.4,
                  color: index == 2 ? rotivaMuted : color,
                  fontWeight: index == 1 ? FontWeight.w800 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );
    }),
  );
}

String interestLabel(String value) =>
    {
      'history': 'Tarih',
      'museum': 'Müze',
      'culture': 'Kültür & Sanat',
      'coffee': 'Kahve',
      'food': 'Yemek',
      'nature': 'Doğa',
      'shopping': 'Alışveriş',
      'view': 'Manzara',
    }[value] ??
    value;

String walkingLabel(String value) =>
    {
      'low': 'Az Yürüyüş',
      'normal': 'Normal',
      'high': 'Yürümeyi Severim',
    }[value] ??
    value;

class RoutesPage extends StatelessWidget {
  const RoutesPage({
    super.key,
    required this.plan,
    required this.parserMetadata,
    required this.onBack,
  });
  final PlanResponse? plan;
  final String? parserMetadata;
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) {
    if (plan == null) {
      return const Center(child: Text('Henüz rota oluşturulmadı.'));
    }
    final summary = plan!.summary;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      children: [
        Row(
          children: [
            IconButton(
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back),
              tooltip: 'Geri',
            ),
            const RotivaMark(compact: true),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'Rotan hazır!',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
            color: rotivaForest,
            fontWeight: FontWeight.w600,
            fontFamily: 'Lora',
            fontSize: 30,
          ),
        ),
        const SizedBox(height: 7),
        const Text(
          'Senin için oluşturduğumuz rota aşağıda. İyi keşifler!',
          textAlign: TextAlign.center,
          style: TextStyle(color: rotivaMuted, height: 1.4),
        ),
        const SizedBox(height: 16),
        RoutePreview(stops: plan!.itinerary, region: plan!.region),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFEEF0E7),
            borderRadius: BorderRadius.circular(14),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _MetricChip(
                  icon: Icons.schedule_outlined,
                  label: '${summary['totalVisitMinutes'] ?? '—'} dk ziyaret',
                ),
                _MetricChip(
                  icon: Icons.route_outlined,
                  label: '${summary['totalDistanceKm'] ?? '—'} km',
                ),
                _MetricChip(
                  icon: Icons.payments_outlined,
                  label: _totalCostLabel(summary),
                ),
                _MetricChip(
                  icon: Icons.place_outlined,
                  label: '${summary['stopCount'] ?? '—'} durak',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 7),
        Text(
          '${summary['totalWalkingMinutes'] ?? '—'} dk yürüyüş  ·  Kalan ${summary['remainingMinutes'] ?? '—'} dk  ·  Skor ${summary['routeScore'] ?? '—'}',
          style: const TextStyle(fontSize: 11, color: Color(0xFF53665B)),
        ),
        const SizedBox(height: 16),
        const Text(
          'DURAKLAR',
          style: TextStyle(
            color: rotivaMuted,
            fontSize: 11,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 10),
        ...plan!.itinerary.asMap().entries.map(
          (entry) => _StopCard(
            stop: entry.value,
            number: entry.key + 1,
            isLast: entry.key == plan!.itinerary.length - 1,
          ),
        ),
        if (plan!.warnings.isNotEmpty) ...[
          const SizedBox(height: 14),
          Card(
            color: const Color(0xFFFFEDE4),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Bilmen gerekenler',
                    style: TextStyle(
                      color: rotivaForest,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ...plan!.warnings
                      .map(
                        (warning) =>
                            warning['message']?.toString().trim() ?? 'Uyarı',
                      )
                      .where((message) => message.isNotEmpty)
                      .toSet()
                      .map(
                        (message) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            '• $message',
                            style: const TextStyle(
                              color: Color(0xFF53665B),
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  static String _totalCostLabel(Map<String, dynamic> summary) {
    if (summary['unknownCostCount'] is! num ||
        (summary['unknownCostCount'] as num) > 0) {
      return 'Maliyet: Bilinmiyor';
    }
    final known = summary['knownCostTRY'];
    final range = summary['uncertainCostRange'];
    if (known is! num) return 'Maliyet: Bilinmiyor';
    if (range is Map && range['min'] is num && range['max'] is num) {
      final min = known + (range['min'] as num);
      final max = known + (range['max'] as num);
      return min == max ? '$min TL' : '$min–$max TL';
    }
    return '$known TL';
  }

  static String _costLabel(dynamic cost) {
    if (cost is! Map || cost['type'] == 'unknownCost') return 'Bilinmiyor';
    final range = cost['rangeTRY'];
    if (range is Map && range['min'] != null && range['max'] != null) {
      return range['min'] == range['max']
          ? '${range['min']} TL'
          : '${range['min']}–${range['max']} TL';
    }
    return range is num ? '$range TL' : 'Bilinmiyor';
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 12),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: rotivaForest),
        const SizedBox(width: 5),
        Text(label, style: const TextStyle(color: rotivaForest, fontSize: 11)),
      ],
    ),
  );
}

class _StopCard extends StatelessWidget {
  const _StopCard({
    required this.stop,
    required this.number,
    required this.isLast,
  });
  final Map<String, dynamic> stop;
  final bool isLast;
  final int number;

  static const _reasonLabels = {
    'high_suitability_score': 'Tercihlerine yüksek uyum sağlıyor',
    'close_to_previous_stop': 'Önceki durağa yakın',
    'fits_remaining_time': 'Kalan sürene uygun',
    'adds_category_diversity': 'Rotaya farklı bir deneyim ekliyor',
    'matches_preferred_category': 'İlgi alanlarınla eşleşiyor',
  };
  static const _categoryLabels = {
    'historical': 'Tarihi Yer',
    'history': 'Tarih',
    'museum': 'Müze',
    'palace': 'Saray',
    'cultural': 'Kültür ve Sanat',
    'culture': 'Kültür ve Sanat',
    'cafe': 'Kafe',
    'coffee': 'Kahve',
    'restaurant': 'Restoran',
    'food': 'Yeme İçme',
    'park': 'Park',
    'nature': 'Doğa',
    'mosque': 'Cami',
    'church': 'Kilise',
    'market': 'Çarşı ve Pazar',
    'shopping': 'Alışveriş',
    'viewpoint': 'Manzara',
    'square': 'Meydan',
    'waterfront': 'Sahil',
    'religious': 'İbadet Yeri',
  };

  @override
  Widget build(BuildContext context) {
    final activity = stop['activityName']?.toString();
    final time = [
      if (stop['arrivalTime'] != null) '${stop['arrivalTime']}',
      if (stop['departureTime'] != null) '${stop['departureTime']}',
    ].join(' · ');
    final reasons = stop['selectionReasons'] is List
        ? (stop['selectionReasons'] as List)
              .where(
                (reason) => number != 1 || reason != 'close_to_previous_stop',
              )
              .map((reason) => _reasonLabels[reason])
              .whereType<String>()
              .toList()
        : <String>[];
    return Stack(
      children: [
        if (!isLast)
          const Positioned(
            top: 28,
            bottom: 0,
            left: 13,
            child: SizedBox(width: 2, child: ColoredBox(color: rotivaLine)),
          ),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: rotivaTerracotta,
                  shape: BoxShape.circle,
                ),
                child: FittedBox(
                  child: Padding(
                    padding: const EdgeInsets.all(5),
                    child: Text(
                      '$number',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: rotivaLine),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x08173B32),
                        blurRadius: 12,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        stop['placeName']?.toString() ?? 'Bilinmeyen durak',
                        style: const TextStyle(
                          color: rotivaForest,
                          fontSize: 15,
                          height: 1.25,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (activity != null && activity.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          activity,
                          style: const TextStyle(
                            color: Color(0xFF53665B),
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: 6),
                      Text(
                        [
                          if (time.isNotEmpty) time,
                          '${stop['visitMinutes'] ?? '—'} dk ziyaret',
                          _categoryLabels[stop['category']] ?? 'Mekân',
                        ].join(' · '),
                        style: const TextStyle(
                          color: Color(0xFF53665B),
                          fontSize: 11,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${stop['walkingMinutesFromPrevious'] ?? '—'} dk yürüyüş · Maliyet: ${RoutesPage._costLabel(stop['cost'])}',
                        style: const TextStyle(
                          color: rotivaForest,
                          fontSize: 11,
                          height: 1.5,
                        ),
                      ),
                      if (reasons.isNotEmpty)
                        Theme(
                          data: Theme.of(
                            context,
                          ).copyWith(dividerColor: Colors.transparent),
                          child: ExpansionTile(
                            tilePadding: EdgeInsets.zero,
                            minTileHeight: 28,
                            childrenPadding: EdgeInsets.zero,
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            title: const Text(
                              'Neden önerildi?',
                              style: TextStyle(
                                fontSize: 12,
                                color: rotivaForest,
                              ),
                            ),
                            children: reasons
                                .map(
                                  (reason) => Align(
                                    alignment: Alignment.centerLeft,
                                    child: Padding(
                                      padding: const EdgeInsets.only(bottom: 4),
                                      child: Text(
                                        '• $reason',
                                        style: const TextStyle(
                                          color: Color(0xFF53665B),
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ErrorPage extends StatelessWidget {
  const ErrorPage({super.key, required this.message, required this.onDismiss});
  final String message;
  final VoidCallback onDismiss;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48),
          const SizedBox(height: 12),
          Text(message),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onDismiss, child: const Text('Kapat')),
        ],
      ),
    ),
  );
}

class _PromptField extends StatefulWidget {
  const _PromptField({
    super.key,
    required this.onSubmit,
    required this.loading,
  });
  final ValueChanged<String> onSubmit;
  final bool loading;
  @override
  State<_PromptField> createState() => _PromptFieldState();
}

class _PromptFieldState extends State<_PromptField> {
  final controller = TextEditingController();
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (context, value, _) => Stack(
          children: [
            TextField(
              controller: controller,
              minLines: 6,
              maxLines: 8,
              maxLength: 500,
              buildCounter:
                  (
                    _, {
                    required currentLength,
                    required isFocused,
                    maxLength,
                  }) => null,
              decoration: const InputDecoration(
                hintText:
                    'Tarihi yerleri gezmek istiyorum.\nÇok yürümeyeyim, güzel bir kahve molası da olsun...',
                hintStyle: TextStyle(color: rotivaMuted, height: 1.4),
                contentPadding: EdgeInsets.fromLTRB(22, 22, 22, 46),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(24)),
                  borderSide: BorderSide(color: Color(0xFFC8D8CC)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(24)),
                  borderSide: BorderSide(color: Color(0xFFC8D8CC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(24)),
                  borderSide: BorderSide(color: rotivaForest, width: 1.5),
                ),
              ),
            ),
            Positioned(
              right: 20,
              bottom: 16,
              child: Text(
                '${value.text.length}/500',
                style: const TextStyle(color: rotivaMuted, fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    ],
  );

  void submit() => widget.onSubmit(controller.text);
}

class PlannerForm {
  String region = 'sultanahmet-eminonu';
  int availableMinutes = 300;
  int budgetTRY = 1000;
  List<String> interests = [];
  String walkingPreference = 'normal';
  List<ActivityPlace> activities = [];
  final Set<String> selected = {};
  void applyInterpretation(InterpretResponse response) {
    final intent = response.intent;
    region = intent['region']?.toString() ?? 'sultanahmet-eminonu';
    availableMinutes = (intent['availableMinutes'] as num?)?.toInt() ?? 0;
    budgetTRY = (intent['budgetTRY'] as num?)?.toInt() ?? 0;
    interests = List<String>.from(intent['interests'] ?? const []);
    walkingPreference = intent['walkingPreference']?.toString() ?? 'normal';
    selected.clear();
    for (final item in response.resolvedActivities) {
      selected.add('${item['placeId']}:${item['activityId']}');
    }
  }

  String get regionLabel =>
      region == 'sultanahmet-eminonu' ? 'Sultanahmet – Eminönü' : region;

  Future<void> loadActivities(
    PlannerApi api,
    List<Map<String, dynamic>> requestedActivities,
  ) async {
    activities = await api.getActivities(region);
    for (final request in requestedActivities) {
      final placeQuery = _fold(request['placeQuery']);
      final activityTokens = _fold(
        request['activityQuery'],
      ).split(' ').where((token) => token.length > 2).toList();
      final matches = activities
          .where((place) => _fold(place.name).contains(placeQuery))
          .expand(
            (place) => place.activities.map(
              (activity) => (place: place, activity: activity),
            ),
          )
          .where(
            (match) => activityTokens.any(
              (token) => _fold(match.activity.name).contains(token),
            ),
          )
          .toList();
      if (matches.length == 1) {
        selected.add(
          '${matches.single.place.id}:${matches.single.activity.activityId}',
        );
      }
    }
  }

  static String _fold(String value) => value
      .toLowerCase()
      .replaceAll('ç', 'c')
      .replaceAll('ğ', 'g')
      .replaceAll('ı', 'i')
      .replaceAll('ö', 'o')
      .replaceAll('ş', 's')
      .replaceAll('ü', 'u');

  bool isSelected(String placeId, String activityId) =>
      selected.contains('$placeId:$activityId');
  void toggleActivity(String placeId, String activityId) {
    final key = '$placeId:$activityId';
    isSelected(placeId, activityId) ? selected.remove(key) : selected.add(key);
  }

  Map<String, dynamic> toRequest() => {
    'region': region,
    'availableMinutes': availableMinutes,
    'budgetTRY': budgetTRY,
    'interests': interests,
    'walkingPreference': walkingPreference,
    'startLocation': {'lat': 41.0056, 'lng': 28.9769},
    'plannedStartTime': '10:00',
    'weather': {'condition': 'clear'},
    'selectedActivities': selected.map((key) {
      final parts = key.split(':');
      return {'placeId': parts[0], 'activityId': parts.sublist(1).join(':')};
    }).toList(),
  };
}

class PlannerApi {
  static const baseUrl = 'http://10.0.2.2:3000';
  Future<Map<String, dynamic>> _json(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final response = method == 'POST'
        ? await http.post(
            Uri.parse('$baseUrl$path'),
            headers: {'content-type': 'application/json'},
            body: jsonEncode(body),
          )
        : await http.get(Uri.parse('$baseUrl$path'));
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data['error']?.toString() ?? 'API hatası (${response.statusCode})',
      );
    }
    return data;
  }

  Future<InterpretResponse> interpret(String text) async {
    final data = await _json(
      '/api/planner/interpret',
      method: 'POST',
      body: {
        'text': text,
        'parserMode': 'llm',
        'providerType': 'gemini',
        'startLocation': {'lat': 41.0056, 'lng': 28.9769},
      },
    );
    return InterpretResponse(data);
  }

  Future<List<ActivityPlace>> getActivities(String region) async {
    final data = await _json('/api/regions/$region/activities');
    return (data['places'] as List<dynamic>? ?? [])
        .map((item) => ActivityPlace.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<PlanResponse> plan(Map<String, dynamic> request) async => PlanResponse(
    await _json('/api/planner/plan', method: 'POST', body: request),
  );
}

class InterpretResponse {
  InterpretResponse(Map<String, dynamic> data)
    : intent = Map<String, dynamic>.from(data['intent'] ?? {}),
      resolvedActivities = List<Map<String, dynamic>>.from(
        (data['resolvedActivities'] as List<dynamic>? ?? []).map(
          (item) => Map<String, dynamic>.from(item as Map),
        ),
      ),
      requestedActivities = List<Map<String, dynamic>>.from(
        (Map<String, dynamic>.from(data['intent'] ?? {})['requestedActivities']
                    as List<dynamic>? ??
                [])
            .map((item) => Map<String, dynamic>.from(item as Map)),
      ),
      parserMetadata = Map<String, dynamic>.from(data['parserMetadata'] ?? {});
  final Map<String, dynamic> intent;
  final List<Map<String, dynamic>> resolvedActivities;
  final List<Map<String, dynamic>> requestedActivities;
  final Map<String, dynamic> parserMetadata;
}

class ActivityPlace {
  ActivityPlace({
    required this.id,
    required this.name,
    required this.activities,
  });
  factory ActivityPlace.fromJson(Map<String, dynamic> json) => ActivityPlace(
    id: json['id'].toString(),
    name: json['name'].toString(),
    activities: (json['activities'] as List<dynamic>? ?? [])
        .map((item) => Activity.fromJson(item as Map<String, dynamic>))
        .toList(),
  );
  final String id;
  final String name;
  final List<Activity> activities;
}

class Activity {
  Activity({
    required this.activityId,
    required this.name,
    required this.durationMinutes,
  });
  factory Activity.fromJson(Map<String, dynamic> json) => Activity(
    activityId: json['activityId'].toString(),
    name: json['name'].toString(),
    durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
  );
  final String activityId;
  final String name;
  final int durationMinutes;
}

class PlanResponse {
  PlanResponse(Map<String, dynamic> data)
    : itinerary = List<Map<String, dynamic>>.from(
        (data['itinerary'] as List<dynamic>? ?? []).map(
          (item) => Map<String, dynamic>.from(item as Map),
        ),
      ),
      region = (data['requestSummary'] as Map?)?['region']?.toString(),
      summary = Map<String, dynamic>.from(data['summary'] ?? {}),
      warnings = List<Map<String, dynamic>>.from(
        (data['warnings'] as List<dynamic>? ?? []).map(
          (item) => Map<String, dynamic>.from(item as Map),
        ),
      );
  final List<Map<String, dynamic>> itinerary;
  final String? region;
  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> warnings;
}
