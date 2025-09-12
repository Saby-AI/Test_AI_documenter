/**
 * Date: 12/09/2025
 * User: Agentic_AI_System_Documenter
 * Code Language: TypeScript
 */
class ReceivingService {
  /**
   * Executes LOADOUT/LOADIN update query.
   * Logs an error if the query fails.
   *
   * @param {number} lnQcount - The count of queries processed.
   * @param {number} lnWcount - The count of warnings recorded.
   * @param {string} fscanentime - Timestamp for scan entry time.
   * @param {string} loadOutLoadinQry - The SQL query string for loading data.
   * @throws {Error} If the database query fails.
   */
  async loadOutLoadin(lnQcount: number, lnWcount: number, fscanentime: string, loadOutLoadinQry: string): Promise<void> {
    try {
      await this.manager().query(`BEGIN ${loadOutLoadinQry}; END;`)
        .catch(error => {
          this.logger.error(
            { lnQcount, lnWcount, fscanentime },
            'Error in LOADOUT/LOADIN UPDATE Query',
            'RECEIVING > PROCESS_OUTCLOSE',
          );
          throw error;
        });
    } catch (error) {
      this.logger.error(
        { error, message: 'LOADIN error OUTCLOSE -->' },
        'Error in OUTCLOSE',
        ReceivingService.name,
      );
    }
    this.logger.debug(
      {
        service: ReceivingService.name,
        curOper: recvo.curOper,
      },
      `receiving --> OUTCLOSE | Elapsed time ${moment().diff(startTime)} ms | OUT Time ${moment().format('HH:mm:ss-SSS')}`,
    );
  }
  /**
   * Checks if the receiving object has a dock assigned, and updates accordingly.
   *
   * @param {ReceivingVO} recvo - The receiving object.
   * @returns {Promise<void>}
   */
  async SEEIFXDOCK(recvo: ReceivingVO): Promise<void> {
    if (
      recvo.lc_batch &&
      recvo.lc_batch.length > 0 &&
      recvo.LOADIN &&
      recvo.LOADIN?.fhasxdock !== true
    ) {
      const HASXDOCKresult = await this.manager().query(
        `BEGIN SELECT TOP 1 id FROM dbo.INV_MST WHERE fcanxdock = 1
         and fproduct = '${recvo.lc_prod}'
         and fcustcode = '${recvo.lc_CustCode}' order by fbatch ASC ; END`
      );
      const HASXDOCK: InvMst = HASXDOCKresult[0];
      if (HASXDOCK) {
        const LOADINresult = await this.manager().query(
          `BEGIN
            SELECT TOP 1 id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, ...
            WHERE fbatch = '${recvo.lc_batch.padStart(7, '0')}' order by fbatch ASC ;
          END`
        );
        const LOADIN: Loadin = LOADINresult[0];
        if (LOADIN) {
          LOADIN.fhasxdock = true;
          await this.manager().query(
            `BEGIN UPDATE Loadin set fhasxdock = 1 WHERE fbatch = '${recvo.lc_batch.padStart(7, '0')}'; END`
          );
          recvo.LOADIN = LOADIN;
        }
      }
    }
  }
  /**
   * Logs an issue with inventory control.
   *
   * @param {string} fwho - The identifier for the user triggering the action.
   * @param {ReceivingVO} recvo - The receiving object associated with the action.
   * @param {string} fproblem - Description of the problem.
   * @param {string} fhowfixed - How the problem was fixed.
   * @param {boolean} fresolved - Indicates if the issue was resolved.
   * @returns {Promise<void>}
   */
  async WRITEINVCONTROL(
    fwho: string,
    recvo: ReceivingVO,
    fproblem: string,
    fhowfixed: string,
    fresolved: boolean,
  ): Promise<void> {
    const fwhen: string = fresolved
      ? `CAST([dbo].[Localdatetime](sysdatetime()) AS datetime2)`
      : `Null`;
    await this.facilityService.getConnection().createEntityManager()
      .query(`BEGIN INSERT into INVCONTROL (foperid, fdatestamp, fworktype, ...) VALUES ('${fwho}', CAST([dbo].[Localdatetime](sysdatetime()) AS datetime2), 'RFDATECHEC', '${recvo.lc_batch}', '${recvo.lc_pal}', '${fproblem}', '${fhowfixed}', '${recvo.lc_CustCode}', '${fresolved ? fwho : ''}', ${fwhen}, ${fresolved ? 1 : 0}); END;`);
  }
  // Further methods can be documented similarly...
}