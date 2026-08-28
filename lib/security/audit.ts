export interface AuditRecord {
  id: string;
  timestamp: string;
  conversationId: string;
  userId: string;
  toolName: string;
  actionCategory: "READ" | "WRITE" | "DESTRUCTIVE";
  status: "success" | "error";
  durationMs: number;
  message?: string;
}

// In-memory audit trail
class AuditLogger {
  private auditRecords: AuditRecord[] = [];

  public log(record: Omit<AuditRecord, "id" | "timestamp">): AuditRecord {
    const fullRecord: AuditRecord = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      ...record
    };

    this.auditRecords.push(fullRecord);
    
    // Cap at 200 records
    if (this.auditRecords.length > 200) {
      this.auditRecords.shift();
    }

    console.log(`[AUDIT LOG] [${fullRecord.actionCategory}] Tool: ${fullRecord.toolName} | Status: ${fullRecord.status} | Duration: ${fullRecord.durationMs}ms`);
    return fullRecord;
  }

  public getRecords(): AuditRecord[] {
    return [...this.auditRecords];
  }

  public clear() {
    this.auditRecords = [];
  }
}

export const auditLogger = new AuditLogger();
