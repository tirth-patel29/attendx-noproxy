import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:attendance_gateway/main.dart';

void main() {
  // Smoke test: the app boots to the student authentication screen.
  // (Deliberately does NOT call main()/ApiService.initialize, so no network is
  // touched during the test.)
  testWidgets('app boots to the student auth screen', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: AttendanceGatewayApp()),
    );
    await tester.pump();

    expect(find.text('Attendance Gateway'), findsWidgets);
  });
}
