// ============================================================================
// ProjectOps360° — Microsoft Project (.mpp) → JSON converter
// ============================================================================
// Runs inside a Vercel Sandbox, never in the application process. The app has
// no JVM (Vercel Functions are Node), and .mpp is an undocumented OLE2 binary
// that only MPXJ can read — so the conversion is isolated here and the app only
// ever handles the JSON that comes back.
//
// Deliberately the smallest possible program: read, write, exit. Any mapping
// into ProjectOps360 entities happens in TypeScript, where it is testable
// without a JVM. This file must stay boring — it is the one piece that cannot
// be unit-tested in CI.
//
//   java -cp "/opt/mpxj/*:/opt/app" Convert <input> <output.json>
//
// Exit codes are distinct so the caller can tell "not a project file" from
// "the converter itself broke", which are different messages to a user.
// ============================================================================

import java.io.File;

import org.mpxj.ProjectFile;
import org.mpxj.json.JsonWriter;
import org.mpxj.reader.UniversalProjectReader;

public final class Convert {
  private static final int EXIT_BAD_USAGE = 2;
  private static final int EXIT_UNREADABLE = 3;
  private static final int EXIT_WRITE_FAILED = 4;

  public static void main(String[] args) {
    if (args.length != 2) {
      System.err.println("usage: Convert <input-file> <output-json>");
      System.exit(EXIT_BAD_USAGE);
    }

    final File input = new File(args[0]);
    ProjectFile project;
    try {
      // UniversalProjectReader sniffs the format, so the same image also reads
      // .mpx, .xml (MSPDI), Primavera XER and others if we ever accept them.
      project = new UniversalProjectReader().read(input);
    } catch (Exception e) {
      System.err.println("unreadable: " + e.getMessage());
      System.exit(EXIT_UNREADABLE);
      return;
    }

    if (project == null) {
      System.err.println("unreadable: not recognised as a project file");
      System.exit(EXIT_UNREADABLE);
      return;
    }

    try {
      JsonWriter writer = new JsonWriter();
      // Include attribute types so the TypeScript side can trust what it reads
      // instead of guessing whether "8" is hours, days or a count.
      writer.setPretty(false);
      writer.write(project, new File(args[1]));
    } catch (Exception e) {
      System.err.println("write_failed: " + e.getMessage());
      System.exit(EXIT_WRITE_FAILED);
    }
  }
}
