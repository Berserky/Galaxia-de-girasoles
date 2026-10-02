package com.nuestragalaxia.companion;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.*;
public class GestureLedgerTest {
 @Test public void firstSyncNeverReplaysOldGestures(){assertTrue(GestureLedger.fresh(false,Set.of(),List.of("old","older")).isEmpty());}
 @Test public void persistedIdsSuppressDuplicatesAfterRestart(){assertEquals(List.of("new"),GestureLedger.fresh(true,Set.of("old"),List.of("old","new","new")));}
 @Test public void disabledSyncCanAdvanceSeenWithoutNotifying(){assertTrue(GestureLedger.fresh(true,Set.of("old","new"),List.of("old","new")).isEmpty());}
 @Test public void watermarkSuppressesOlderIdsReappearingAfterDeletion(){assertTrue(GestureLedger.before("2026-10-01T10:00:00Z","2026-10-02T10:00:00+00:00"));assertFalse(GestureLedger.before("2026-10-02T10:00:00Z","2026-10-02T10:00:00+00:00"));assertTrue(GestureLedger.before("invalid","2026-10-02T10:00:00Z"));}
}
