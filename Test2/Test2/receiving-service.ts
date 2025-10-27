/**
 * @date 27/10/2025
 * @user Agentic_AI_System_Documenter
 * @codeLanguage TypeScript
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { EntityManager, Repository } from 'typeorm';
import { plainToClass } from 'class-transformer';
import { Code2 } from 'entities/Code2';
import { EdiPal } from 'entities/EdiPal';
import { PhyMst } from 'entities/PhyMst';
import { ResponseKeysDTO } from 'shared/dtos/responsekeys.dto';
import { PostRequestReceivingDTO } from './_dtos/post.request.dto';
import { PostResponseReceivingDTO } from './_dtos/post.response.dto';
import { ReceivingState } from './receiving.enum';
import { CustomLogger } from 'modules/logger/custom.logger';
import { ConnectRFCacheService } from 'modules/cache/cache.service';
@Injectable()
export class ReceivingService {
  constructor(
    @InjectRepository(PhyMst)
    private phymstRepo: () => Repository<PhyMst>,
    @InjectRepository(EdiPal)
    private editPAlRepo: () => Repository<EdiPal>,
    @InjectRepository(Code2)
    private code2Repo: () => Repository<Code2>,
    @InjectEntityManager()
    private manager: () => EntityManager,
    private eventEmitter: EventEmitter2,
    private httpService: HttpService,
    private readonly cacheService: ConnectRFCacheService,
    private logger: CustomLogger,
  ) {}
  /**
   * Executes the receiving process based on the provided input.
   * @param fwho - The identifier for the user or process executing the receiving.
   * @param pcMachineID - The ID of the machine processing the receiving.
   * @param body - The request body containing input parameters.
   * @returns A promise containing the response keys DTO.
   */
  async executeReceiving(
    fwho: string,
    pcMachineID: string,
    body: PostRequestReceivingDTO,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let recvo = new ReceivingVO();
    const scanFields: string[] = [];
    recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
    const cacheResults: unknown = await this.cacheService.getCache(fwho);
    const { constants: constant } = await this.formBuilderService.fieldsByScreen(this.manager(), 'INBOUNDRECEIVING', cacheResults as string);
    const footer = [
      {
        key: 'F5',
        rawID: 'receivingF5',
        label: constant.EXIT,
        title: constant.EXIT,
      },
      {
        key: 'F2',
        rawID: 'receivingF2',
        label: constant.SKIP,
        title: constant.SKIP,
      },
    ];
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.RECEIVING) {
        recvo = obj.RECEIVING as ReceivingVO;
      }
    }
    if (
      pcMachineID &&
      pcMachineID.length > 0 &&
      (recvo.pcMachineID === '' || recvo.pcMachineID === undefined)
    ) {
      recvo.pcMachineID = pcMachineID;
    }
    recvo.fwho = fwho;
    const startTime = moment();
    this.logger.debug(
      {
        fwho,
        startTime: `${moment().format('HH:mm:ss-SSS')}`,
        payLoad: body,
      },
      `Execute > Receiving  > ${recvo.curOper}`,
    );
    let result;
    if (body.pnInput && body.pnInput.toUpperCase() === 'F5') {
      return this.processExit(fwho, recvo, constant);
    }
    if (
      body.pnInput &&
      body.pnInput.toUpperCase() === 'F4' &&
      recvo.curOper === ReceivingState.MARK_PROCESS_LOT
    ) {
      result = await this.processF4Lot(fwho, recvo, constant);
    } else {
      if (
        body.pnInput &&
        body.pnInput.toUpperCase() === 'F2' &&
        (recvo.curOper === ReceivingState.MARK_PROCESS_DATE ||
          recvo.curOper === ReceivingState.MARK_PROCESS_BB_DATE ||
          recvo.curOper === ReceivingState.MARK_PROCESS_BB_JDATE)
      ) {
        result = this.processF2(fwho, recvo, constant, footer);
      } else {
        switch (recvo.curOper) {
          case ReceivingState.MARK_RECEIVING_CLOSE: {
            result = this.processClose(fwho, body, recvo, constant);
            break;
          }
          // Additional cases for other operations...
        }
      }
    }
    return result;
  }
  /**
   * Processes the exit operation for receiving.
   * @param fwho - The identifier for the user or process executing the exit.
   * @param recvo - The receiving value object containing current state.
   * @param constant - Constants used for processing.
   * @returns A promise containing the response keys DTO.
   */
  async processExit(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let infoMsg = '';
    recvo.prevCurOper = recvo.curOper;
    if (
      recvo.curOper === ReceivingState.MARK_PROCESS_MOD_PAL ||
      recvo.curOper === ReceivingState.MARK_PROCESS_GET_MOD
    ) {
      if (recvo.allowReceiverPutAway) {
        recvo.pcPutAway = 'N';
        recvo.curOper = ReceivingState.MARK_PROCESS_PUT_AWAY;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        return new ResponseKeysDTO(
          plainToClass(PostResponseReceivingDTO, {
            errMsg: '',
            infoMsg,
            curOper: recvo.curOper,
          }),
          getOutFieldState(recvo.curOper),
          '',
          '',
          `${constant.F5_EXIT}`,
        );
      }
      return this.processLastPallet(fwho, recvo, constant);
    }
    recvo.curOper = ReceivingState.MARK_RECEIVING_EXIT;
    if (recvo.lc_batch && recvo.lc_batch.trim().length > 0) {
      if (recvo.lc_pal && recvo.lc_pal.length > 0) {
        infoMsg = constant.DATA_NOT_SENT;
        await this.manager().query(`BEGIN
          Declare @lc_pal char(20), @checkExistID int;
          SET @lc_pal = '${recvo.lc_pal}'
          SELECT @checkExistID =  id FROM dbo.PHY_MST WHERE FPALLETID  = @lc_pal and FQTY = 0 and SUBSTRING(FTRACK, 8,10) = '   ';
          IF @checkExistID > 0
          BEGIN
            DELETE FROM [dbo].[PHY_MST] WHERE [ID] = @checkExistID;
          END
          END`);
      }
      recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE;
      const LOADINresult = await this.manager().query(
        `BEGIN SELECT id, trim(fscanstat) fscanstat FROM dbo.Loadin WHERE fbatch = '${recvo.lc_batch}' order by fbatch ASC ; END`,
      );
      const LOADIN: Loadin = LOADINresult[0];
      if (LOADIN && LOADIN.fscanstat) {
        recvo.pcMultiRecScanStat = LOADIN.fscanstat;
      }
      if (recvo.plMultiReceiver && recvo.pcMultiRecScanStat === 'R') {
        recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE_REC;
      } else {
        recvo.curOper = ReceivingState.MARK_PROCESS_PALLET;
        const d = getFields(ReceivingState.MARK_PROCESS_PALLET);
        if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
          d.maxFieldLen = recvo.RFREQ.fscanlngth;
        scrnUI.push(d);
        recvo.lc_pal = '';
        recvo.plUsedF8 = false;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        return new ResponseKeysDTO(
          plainToClass(PostResponseReceivingDTO, {
            errMsg: '',
            infoMsg,
            curOper: recvo.curOper,
            scrnUI,
          }),
          getOutFieldState(recvo.curOper),
          '',
          '',
          `${constant.F5_EXIT}`,
        );
      }
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg: '',
        infoMsg, curOper: recvo.curOper,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }
  // Add similar documentation for the rest of the methods...