import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { EntityManager, Repository, Like, Brackets } from 'typeorm';
import { plainToClass } from 'class-transformer';
import { Code2 } from 'entities/Code2';
import { Config } from 'entities/Config';
import { Codelkup } from 'entities/Codelkup';
import { Downstack } from 'entities/Downstack';
import { EdiPal } from 'entities/EdiPal';
import { Iconfirm } from 'entities/Iconfirm';
import { InvTrn } from 'entities/InvTrn';
import { InvMst } from 'entities/InvMst';
import { Loadin } from 'entities/Loadin';
import { PhyDet } from 'entities/PhyDet';
import { PhyMst } from 'entities/PhyMst';
import { PhyTrn } from 'entities/PhyTrn';
import { Quickrec } from 'entities/Quickrec';
import { Rfexpinv } from 'entities/Rfexpinv';
import { Rfreq } from 'entities/Rfreq';
import { FacilityService } from 'modules/database/facility/facility.service';
import { StoredProceduresNewService } from 'modules/stored-procedures/stored-procedures-new.service';
import { APIExternalPostService } from 'modules/rfcommon/api-external-post/service';
import { ConnectRFCacheService } from 'modules/cache/cache.service';
import { CustomLogger } from 'modules/logger/custom.logger';
import { PalletMergeVo } from 'modules/palletmerge/palletmerge/vos/palletMergeVo';
import { BaseService } from 'shared/baseModules/service';
import { ResponseKeysDTO } from 'shared/dtos/responsekeys.dto';
import { GlobalDTO } from 'shared/dtos/global.dto';
import { CatchWeightVO } from 'modules/catchweights/vos/catchWeightVo';
import { Field, Summary } from 'modules/formbuilder/_dtos/screen.interface';
import { FieldItem } from 'modules/formbuilder/_dtos/fielditem';
import { LoadingVO } from 'modules/outbound/loading/vos/loadingvo';
import { ValidateDTO } from 'modules/rfcommon/service';
import { GlobalisationService } from 'modules/globalisation/service';
import { FormBuilderService } from 'modules/formbuilder/service';
import { DynamicAttributesService } from 'modules/rfcommon/dynamic-attribute/dynamic-attr-service';
import { LoadinBatch } from './vos/loadinbatch';
import {
  getFields,
  getOutFieldState,
  getLabelFields,
  getOutputFields,
  getOutputFieldsExit,
  getObjFields,
} from './getFields';
import { ReceivingVO } from './vos/receivingvo';
import { RecevingEvent } from './vos/receiving.event';
import { PostRequestReceivingDTO } from './_dtos/post.request.dto';
import { PostResponseReceivingDTO } from './_dtos/post.response.dto';
import { ReceivingState } from './receiving.enum';
import { BeltPrinterService } from 'modules/common/beltprinter.service';
import { ModuleNameEnum } from 'enums/module.enum';
import { MaskingTypeEnum } from 'enums/MaskingTypeEnum';
import { ValidateMaskDefinitionService } from 'modules/common/validateMaskDefinition';

const moment = require('moment');
const lodash = require('lodash');

const { gcDynamicSlottingWebApiUrl } = (global as unknown) as GlobalDTO;

const RECEIVING: string = 'RECEIVING';

const OBLOADING: string = 'OBLOADING';

@Injectable()
export class ReceivingService extends BaseService {
  constructor(
    @InjectRepository(PhyMst)
    private phymstRepo: () => Repository<PhyMst>,
    @InjectRepository(EdiPal)
    private editPAlRepo: () => Repository<EdiPal>,
    @InjectRepository(Code2)
    private code2Repo: () => Repository<Code2>,
    @InjectRepository(PhyTrn)
    private phyTrnRepo: () => Repository<PhyTrn>,
    @InjectRepository(PhyDet)
    private phyDetRepo: () => Repository<PhyDet>,
    @InjectRepository(InvMst)
    private invMstRepo: () => Repository<InvMst>,
    @InjectRepository(InvTrn)
    private invTrnRepo: () => Repository<InvTrn>,
    @InjectEntityManager()
    private manager: () => EntityManager,
    private eventEmitter: EventEmitter2,
    private httpService: HttpService,
    private readonly cacheService: ConnectRFCacheService,
    private readonly storedProceduresNewService: StoredProceduresNewService,
    private readonly apiExternalPostService: APIExternalPostService,
    private facilityService: FacilityService,
    private globalizationService: GlobalisationService,
    private logger: CustomLogger,
    private formBuilderService: FormBuilderService,
    private dynamicAttributesService: DynamicAttributesService,
    private validateMaskDefinitionService: ValidateMaskDefinitionService,
    private beltPrinterService: BeltPrinterService,
    private readonly storedProcedureService: StoredProceduresNewService,
  ) {
    super();
    this.facilityService.injectRepos(this);
  }

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
    // this.logger.debug(`receiving --> executeReceiving | Start time ${moment().format('HH:mm:ss-SSS')} |  ${fwho} | ${recvo.curOper} | ${JSON.stringify(this.body)}`, ReceivingService.name);
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
          case ReceivingState.MARK_RECEIVING_CLOSE_AR: {
            result = this.processCloseAR(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_RECEIVING_CLOSE_P:
          case ReceivingState.MARK_RECEIVING_CLOSE_REC: {
            result = this.processCloseRec(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_RECEIVING_CLOSE_W: {
            result = this.processCloseWP(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_RECEIVING_EXIT: {
            result = this.processExit(fwho, recvo, constant);
            break;
          }
          case ReceivingState.MARK_SHOW_NOTES:
          case ReceivingState.MARK_PROCESS_BATCH: {
            result = this.processBatch(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_PALLET: {
            result = this.processPalletIDPrinter(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_PALLET_RESCAN: {
            result = this.processRescanPal(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_CUST_PALLET: {
            result = this.processCustPal(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_PROD: {
            result = this.processProduct(fwho, body, recvo, constant, footer);
            break;
          }
          case ReceivingState.MARK_PROCESS_DATE: {
            result = this.SCANDATE(
              fwho,
              body,
              recvo,
              constant,
              scanFields,
              footer,
            );
            break;
          }
          case ReceivingState.MARK_PROCESS_QTY:
          case ReceivingState.MARK_PROCESS_QTY_YN: {
            result = this.processQty(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_BLAST: {
            result = this.processBlast(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_LOT: {
            result = this.processLotNo(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_CLOT: {
            result = this.processCustLotNo(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_EST: {
            result = this.processEST(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_SDATE: {
            result = this.processSDate(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_REF: {
            result = this.processRef(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_TEMP: {
            result = this.processTemp(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_BB_JDATE:
          case ReceivingState.MARK_PROCESS_BB_DATE: {
            result = this.processBBdate(fwho, body, recvo, constant, footer);
            break;
          }
          case ReceivingState.MARK_PROCESS_CONSIGNEE: {
            result = this.processConsignee(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_SEND_PALLET: {
            result = this.processSendPallet(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PALLET_TYPE: {
            result = this.processPalletType(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_GET_MOD: {
            result = this.GetModPallet(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_MOD_PAL: {
            result = this.processGetModPallet(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_PUT_AWAY: {
            result = this.processPutAway(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PALLET_MERGE: {
            result = this.processPalletMerge(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_CHANGE_CODE_DATE: {
            result = this.changeCodeDate(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_RECEIVING_GETMACHINEID: {
            result = this.processMachineId(fwho, recvo, body, constant);
            break;
          }
          case ReceivingState.QUICK_RECV_AFTER_CATCH_WGT: {
            result = this.quickReceiverAfterCatchWgt(fwho, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_BOL_QTY: {
            result = this.processDWRailBolQty(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_TIE_YN: {
            result = this.processDWRailTieYN(
              fwho,
              body,
              recvo,
              constant,
              footer,
            );
            break;
          }
          case ReceivingState.MARK_PROCESS_TIE: {
            result = this.processDWRailTie(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_HIGH: {
            result = this.processDWRailHigh(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_BELT_PRINTER: {
            recvo.redirectOnSuccess = 'processSendPallet';
            result = this.beltPrinterService.processPrinter<
              PostRequestReceivingDTO,
              ReceivingVO
            >(
              fwho,
              body,
              recvo,
              constant,
              ModuleNameEnum.RECEIVE,
              { fwho, receiveBody: body },
              this,
            );
            break;
          }
          case ReceivingState.MARK_VERIFY_PALLET: {
            result = this.beltPrinterService.verifyPallet<
              PostRequestReceivingDTO,
              ReceivingVO
            >(
              fwho,
              body,
              recvo,
              constant,
              ModuleNameEnum.RECEIVE,
              { fwho, receiveBody: body },
              this,
            );
            break;
          }
          default: {
            result = new ResponseKeysDTO(
              plainToClass(PostResponseReceivingDTO, {
                errMsg: 'Invalid MARK Operation Error',
                infoMsg: '',
                curOper: recvo.curOper,
              }),
              getOutFieldState(recvo.curOper),
              '',
              '',
              `${constant.F5_EXIT}`,
            );
            break;
          }
        }
      }
      this.logger.debug(
        `receiving --> executeReceiving | End time ${moment().format(
          'HH:mm:ss-SSS',
        )} |  ${fwho} | ${recvo.curOper}`,
        ReceivingService.name,
      );
      this.logger.debug(
        `receiving --> executeReceiving | Elapsed time ${moment().diff(
          startTime,
        )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')} |  ${fwho} | ${
          recvo.curOper
        }`,
        ReceivingService.name,
      );
    }
    return result;
  }

  async processExit(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    // line 2189 - && see if pallet needs to be deleted if cancelled
    // const perMsg = (recvo.dynBat === '' || recvo.lc_mergepal !== 'Y') ? await this.performanceService.execute(fwho) : undefined;
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
      } else if (recvo.plMultiReceiver === false) {
        recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE;
      } else if (recvo.pcMultiRecScanStat !== 'R') {
        recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE_AR;
        recvo.fwho = fwho;
        // recvo.curOper = 'MARK_PROCESS_BATCH';
        const cacheResults: unknown = await this.cacheService.getCache(fwho);
        if (cacheResults && cacheResults !== '') {
          const obj = JSON.parse(cacheResults as string);
          if (obj && obj.DYNAMICWAREHOUSE) {
            // infoMsg = 'DYNAMICWAREHOUSE';
            recvo.dynBat = recvo.lc_batch.padStart(7, '0');
            recvo.originator = 'DYNAMICWAREHOUSE';
          }
        }

        // recvo.pcMachineID = recvo.pcMachineID;
      }
      if (recvo.prevCurOper === ReceivingState.MARK_SHOW_NOTES) {
        infoMsg = constant.DATA_NOT_SENT;
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else {
      infoMsg = 'RFINBOUNDMAINMENU';
      // if (await this.facilityService.isDWEnabled(this.manager())) {
      const cacheResults: unknown = await this.cacheService.getCache(fwho);
      if (cacheResults && cacheResults !== '') {
        const obj = JSON.parse(cacheResults as string);
        if (obj && obj.DYNAMICWAREHOUSE) {
          infoMsg = 'DYNAMICWAREHOUSE';
          recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
        } else {
          await this.cacheService.delete2Obj(fwho, RECEIVING, 'CATCHWEIGHT');
          recvo.curOper = ReceivingState.MARK_RECEIVING_EXIT;
        }
      } else {
        await this.cacheService.delete2Obj(fwho, RECEIVING, 'CATCHWEIGHT');
        recvo.curOper = ReceivingState.MARK_RECEIVING_EXIT;
      }
      return new ResponseKeysDTO(
        plainToClass(PostResponseReceivingDTO, {
          errMsg: '',
          infoMsg,
          curOper: recvo.curOper,
          // perMsg,
        }),
        getOutputFieldsExit(ReceivingState.MARK_PROCESS_BATCH),
        '',
        '',
        `${constant.F5_EXIT}`,
      );
    }

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

  async processF4Lot(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    if (recvo.f4Lot === 0) {
      recvo.f4Lot += 1;
      errMsg = constant.LOT_NOT_BLANK;
    } else if (recvo.f4Lot === 1) {
      recvo.f4Lot = 0;
      recvo.lc_lot = '';
      recvo.curOper = this.findNextState(recvo);
    }
    await this.cacheService.setcache(fwho, RECEIVING, recvo);
    const scrnUI = [];
    let data = {};
    if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
      data = {
        footer: undefined,
        label: getLabelFields('assumeText'),
        palNo: recvo.lc_pal,
        prod: recvo.lc_prod,
      };
      scrnUI.push(...this.summary2(recvo));

      //dynamic attribute code added
      const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
      scrnUI.push(...dynamicAttributes); // Push dynamic attribute data
    }
    if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
      const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
      q.defaultVal = recvo.curTempVal;
      scrnUI.push(q);
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processCloseAR(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let plPalletInWorking: boolean = false;
    let infoMsg = '';
    const scrnUI = [];
    if (
      body.closePalAR &&
      body.closePalAR.length > 0 &&
      body.closePalAR === 'Y'
    ) {
      const PHYMSTres = await this.manager().query(
        `BEGIN SELECT id, ftrack FROM dbo.PHY_MST WHERE ftrack = '${recvo.lc_batch}' order by ftrack ASC ; END`,
      );
      const PHY_MST: PhyMst = PHYMSTres[0];
      if (PHY_MST) {
        plPalletInWorking = true;
      }
      infoMsg = '';
      if (plPalletInWorking) {
        // setTimeout(this.tiggerINCLOSE, 500, this.eventEmitter, fwho, recvo);
        recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE_W;
      } else {
        // await this.INCLOSE(fwho, recvo);
        setTimeout(this.tiggerINCLOSE, 500, this.eventEmitter, fwho, recvo);
        if (recvo.dynBat && recvo.dynBat.length > 0) {
          recvo.lc_mergepal = 'N';
          recvo.curOper = ReceivingState.MARK_PALLET_MERGE;
          const c = getFields(ReceivingState.MARK_PALLET_MERGE);
          c.label = `${c.label} ${recvo.dynBat}`;
          scrnUI.push(c);
        } else {
          let machineId = '';
          if (recvo && recvo.llQuickrcv && recvo.lcInMachineID) {
            machineId = recvo.lcInMachineID;
            recvo = new ReceivingVO();
            recvo.lcInMachineID = machineId;
            recvo.fwho = fwho;
          } else {
            recvo = new ReceivingVO();
          }
          recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
        }
      }
    } else {
      let machineId = '';
      const currBatch = recvo.lc_batch;
      if (recvo && recvo.llQuickrcv && recvo.lcInMachineID) {
        machineId = recvo.lcInMachineID;
        recvo = new ReceivingVO();
        recvo.lcInMachineID = machineId;
        recvo.fwho = fwho;
      } else {
        recvo = new ReceivingVO();
      }
      // if (await this.facilityService.isDWEnabled(this.manager())) {
      const cacheResults: unknown = await this.cacheService.getCache(fwho);
      if (cacheResults && cacheResults !== '') {
        const obj = JSON.parse(cacheResults as string);
        if (obj && obj.DYNAMICWAREHOUSE) {
          infoMsg = 'DYNAMICWAREHOUSE';
        }
      }
      // }
      const [PHYMSTres] = await this.manager().query(
        `BEGIN SELECT count(id) as activePals FROM dbo.PHY_MST WHERE ftrack = '${currBatch}'; END`,
      );
      if (PHYMSTres && PHYMSTres.activePals > 0) {
        recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE_W;
      } else {
        recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
      }
    }
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

  async processCloseWP(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let value = '';
    let infoMsg = '';
    if (body.closePalW && body.closePalW.length > 0) {
      value = body.closePalW;
    }
    if (value?.length > 0) {
      let machineId = '';
      if (recvo && recvo.llQuickrcv && recvo.lcInMachineID) {
        machineId = recvo.lcInMachineID;
        recvo = new ReceivingVO();
        recvo.lcInMachineID = machineId;
        recvo.fwho = fwho;
      } else {
        recvo = new ReceivingVO();
      }
      // if (await this.facilityService.isDWEnabled(this.manager())) {
      const cacheResults: unknown = await this.cacheService.getCache(fwho);
      if (cacheResults && cacheResults !== '') {
        const obj = JSON.parse(cacheResults as string);
        if (obj && obj.DYNAMICWAREHOUSE) {
          infoMsg = 'DYNAMICWAREHOUSE';
        }
      }
      // }
      recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }

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

  async processCloseRec(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    if (
      (body.closePalR && body.closePalR.length > 0) ||
      (body.closePalP && body.closePalP.length > 0)
    ) {
      let machineId = '';
      if (recvo && recvo.llQuickrcv && recvo.lcInMachineID) {
        machineId = recvo.lcInMachineID;
        recvo = new ReceivingVO();
        recvo.lcInMachineID = machineId;
        recvo.fwho = fwho;
      } else {
        recvo = new ReceivingVO();
      }
      recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: recvo.curOper,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processClose(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE;

    let infoMsg = '';
    const scrnUI = [];

    // line 2242 - && see if pallet needs to be deleted if cancelled

    let lcClose = '';
    if (body.closeBat && body.closeBat === 'Y') {
      lcClose = body.closeBat;
    }
    let additionalProps = {};
    if (lcClose.toUpperCase() === 'Y') {
      // await this.INCLOSE(fwho, recvo);
      setTimeout(this.tiggerINCLOSE, 500, this.eventEmitter, fwho, recvo);
      if (recvo.dynBat && recvo.dynBat.length > 0) {
        recvo.lc_mergepal = 'N';
        recvo.curOper = ReceivingState.MARK_PALLET_MERGE;
        const c = getFields(ReceivingState.MARK_PALLET_MERGE);
        c.label = `${c.label} ${recvo.dynBat}`;
        scrnUI.push(c);
      } else {
        let machineId = '';
        if (recvo && recvo.llQuickrcv && recvo.lcInMachineID) {
          machineId = recvo.lcInMachineID;
          recvo = new ReceivingVO();
          recvo.lcInMachineID = machineId;
          recvo.fwho = fwho;
        } else {
          recvo = new ReceivingVO();
        }
        recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
      }
    } else {
      recvo.curOper =
        recvo.prevCurOper === 'MARK_RECEIVING_GETMACHINEID'
          ? ReceivingState.MARK_RECEIVING_GETMACHINEID
          : ReceivingState.MARK_PROCESS_PALLET;
      if (recvo.lc_pal && recvo.lc_pal?.trim().length > 0) {
        infoMsg = constant.DATA_NOT_SENT;
        recvo.lc_pal = '';
      }
      if (recvo.prevCurOper === ReceivingState.MARK_SHOW_NOTES) {
        let notes;
        if (recvo.LOADIN.fcustcode && recvo.LOADIN.fconsignor.trim() !== '') {
          // Get notes from stored procedure
          const spResult = await this.storedProcedureService.getRfShowcustomerconsigneenotes({
            lcconsig: recvo.LOADIN.fconsignor.trim().replace('/', ''),
            lccustomer: recvo.LOADIN.fcustcode,
            lctype: 'RECV',
            lnheight: 4
          });

          // Get the first note from recordset with type checking
          const firstNote = typeof spResult?.recordset?.[0]?.NOTE === 'string'
            ? spResult.recordset[0].NOTE
            : '';

          // Create curNotes with just the note, removing any newline characters
          const curNotes = [{
            note: firstNote.replace(/\n/g, '').trim()
          }];
          // Properly access note from the array
          notes = curNotes[0]?.note || '';
        } else if (recvo.LOADIN.fcustcode && recvo.LOADIN.fconsignor.trim() === '') {
          const [curNotes] = await this.manager().query(`BEGIN
          DECLARE @curNotes TABLE (FLINE int, NOTE varchar(38));
          INSERT INTO @curNotes EXEC [dbo].[usp_RF_ShowCustomerConsigneeNotes]
          @lcCustomer = '${recvo.LOADIN.fcustcode}',
          @lcConsig = '',
          @lcType = 'RECV',
          @lnHeight  = 4;
          SELECT TOP 1 note FROM @curNotes;
          END`);
          notes = curNotes && curNotes.note ? curNotes.note : '';
        }
        if (
          !notes &&
          recvo.quickRec &&
          recvo.quickRec.fquickrcv?.trim().length > 0
        ) {
          const rcvType = recvo.quickRec?.fquickrcv;
          const notesData: Record<string, string> = {
            L: constant.LEAVE_ON_TRUCK,
            D: constant.STORE_ON_DOCK,
            S: constant.STORE_IN_FREEZER,
          };
          notes = notesData[rcvType] || '';
        }
        if (notes) {
          recvo.curOper = ReceivingState.MARK_SHOW_NOTES;
          additionalProps = {
            data: notes,
            label: 'Notes',
          };
        }
      }
    }
    await this.cacheService.setcache(fwho, RECEIVING, recvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg: '',
        infoMsg,
        curOper: recvo.curOper,
        scrnUI,
        ...additionalProps,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processPalletMerge(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let infoMsg;
    if (body.merBat?.trim()?.toUpperCase() === 'Y') {
      infoMsg = 'MergePallets';
      const machineId = recvo.lcInMachineID;
      recvo = new ReceivingVO();
      recvo.lcInMachineID = machineId;
      recvo.fwho = fwho;
      recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
      const p = new PalletMergeVo();
      p.curOper = 'MARK_PROCESS_PALLET';
      p.originator = RECEIVING;
      await this.cacheService.set2Obj(fwho, RECEIVING, recvo, 'PALMERGE', p);
    } else if (body.merBat?.trim()?.toUpperCase() === 'N') {
      infoMsg = 'DYNAMICWAREHOUSE';
      await this.cacheService.delete2Obj(fwho, RECEIVING, 'CATCHWEIGHT');
      recvo.curOper = ReceivingState.MARK_RECEIVING_EXIT;
      // if (await this.facilityService.isDWEnabled(this.manager())) {
      // const cacheResults: unknown = await this.cacheService.getCache(fwho);
      // if (cacheResults && cacheResults !== '') {
      //   const obj = JSON.parse(cacheResults as string);
      //   if (obj && obj.DYNAMICWAREHOUSE) {
      //     const dynamicvo = obj.DYNAMICWAREHOUSE as DynamicWarehouseVO;
      //     dynamicvo.pcWorkingZone = '000';
      //     await this.dynamicWarehouseService.fetchData(fwho, dynamicvo);
      //   }
      // }
      // }
    }

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

  tiggerINCLOSE(eventEmitter: EventEmitter2, fwho: string, recvo: ReceivingVO) {
    const recvoEvent = new RecevingEvent();
    recvoEvent.fwho = fwho;
    recvoEvent.recvo = recvo;
    eventEmitter.emit('RecevingINCLOSE.updated', recvoEvent);
  }

  async dpaINCLOSE(fwho: string) {
    let recvo = new ReceivingVO();
    recvo.curOper = ReceivingState.MARK_PROCESS_BATCH;
    const cacheResults: unknown = await this.cacheService.getCache(fwho);
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.RECEIVING) {
        recvo = obj.RECEIVING as ReceivingVO;
      }
    }
    setTimeout(this.tiggerINCLOSE, 500, this.eventEmitter, fwho, recvo);
  }

  @OnEvent('RecevingINCLOSE.updated')
  async INCLOSE(event: RecevingEvent): Promise<void> {
    // async INCLOSE(fwho: string, recvo: ReceivingVO): Promise<void> {
    const { recvo, fwho } = event;
    const startTime = moment();
    this.logger.debug(
      {
        fwho,
        startTime: `${moment().format('HH:mm:ss-SSS')}`,
        recvo,
        curOper: recvo.curOper,
      },
      `INCLOSE > BEGIN with ${recvo.curOper}`,
    );
    const fbatch = recvo.lc_batch;
    const LOADIN = (recvo.LOADIN as unknown) as Loadin;

    const timeZoneIANA = this.facilityService.getWareHouseSettings().timeZoneIANA;

    if (LOADIN && LOADIN.fshipstat !== 'Y') {
      this.logger.debug({ LOADIN }, 'INCLOSE > LOADIN fshipstat === Y');
      LOADIN.fshipstat = 'N';

      let INV_TRN = await this.invTrnRepo().findOne({ fbatch });
      const PHY_MST_ARR = await this.phymstRepo().find({
        ftrack: Like(`${fbatch}%`),
      });
      const PHY_TRN_ARR = await this.phyTrnRepo().find({ fbatch });
      const INV_MST_ARR = await this.invMstRepo().find({ fbatch });

      let delInvMstIds = '';
      let delInvTrnIds = '';
      let delPhyMstIds = '';
      let delPhyTrnIds = '';

      for (const INV_MST of INV_MST_ARR) {
        if (INV_MST && INV_MST.fbatch === fbatch) {
          this.logger.debug(
            { ftrack: `${INV_MST.fbatch}${INV_MST.fsequence}` },
            'INCLOSE > FTRACK',
          );
          let llLothasHPP = false;
          INV_TRN = await this.invTrnRepo().findOne({
            fbatch: INV_MST.fbatch,
            fsequence: INV_MST.fsequence,
          });
          let invMstfoQty = 0;
          if (INV_TRN) {
            let lnpals = 0;
            let lnqty = 0;

            // * We're Ok To Update The INV_MST and INV_TRN Records
            const PHY_MST_ARR_TEMP = await this.phymstRepo().find({
              ftrack: `${INV_MST.fbatch}${INV_MST.fsequence}`,
            });
            for (const PHY_MST of PHY_MST_ARR_TEMP) {
              if (PHY_MST) {
                this.logger.debug(
                  { fship: PHY_MST.fishpp, lnqty, fqty: PHY_MST.fqty },
                  'INCLOSE > PHY_MST > FSHIP',
                );
                lnqty += PHY_MST.fqty;
                if (PHY_MST.fishpp) {
                  llLothasHPP = true;
                }
                // * Find The PHY_TRN Record
                const PHY_TRN = PHY_TRN_ARR.find(
                  (item: PhyTrn) =>
                    item.fbatch === INV_MST.fbatch &&
                    item.fsequence === INV_MST.fsequence &&
                    item.ftrack === PHY_MST.ftrack &&
                    item.fserial === PHY_MST.fserial,
                );
                if (PHY_TRN) {
                  this.logger.debug(
                    {
                      trnId: PHY_TRN.id,
                      mstId: PHY_MST.id,
                      updatedLnQty: lnqty,
                      trnFqty: PHY_TRN.fqty,
                      mstFqty: PHY_MST.fqty,
                    },
                    'INCLOSE > PHY_TRN',
                  );
                  if (PHY_TRN?.fqty === 0 && PHY_MST.fqty === 0) {
                    delPhyMstIds =
                      delPhyMstIds === ''
                        ? `${PHY_MST.id}`
                        : `${delPhyMstIds},${PHY_MST.id}`;

                    delPhyTrnIds =
                      delPhyTrnIds === ''
                        ? `${PHY_TRN.id}`
                        : `${delPhyTrnIds},${PHY_TRN.id}`;
                  } else {
                    lnpals += 1;
                    let updatePhyMstPhyTrn = '';
                    updatePhyMstPhyTrn = `UPDATE PHY_MST SET FPAL = 1, fo_qty = ${PHY_MST.fqty}, fo_pal= ${PHY_MST.fpal} WHERE id = ${PHY_MST.id};`;
                    updatePhyMstPhyTrn = `${updatePhyMstPhyTrn} UPDATE PHY_TRN SET FPAL = 1 WHERE id = ${PHY_TRN.id};`;
                    await this.manager().query(
                      `BEGIN ${updatePhyMstPhyTrn}; END;`,
                    );
                  }
                }
              }
            }

            if (llLothasHPP) {
              for (const PHY_MST of PHY_MST_ARR) {
                if (
                  PHY_MST.ftrack === `${INV_MST.fbatch}${INV_MST.fsequence}`
                ) {
                  let plUseStackHold = false;
                  let plFoundEDIHPPHold = false;
                  let pcEDIHPPValue = 'HPP';

                  const result = await this.storedProceduresNewService.getRfInboundscheckhpp(
                    {
                      customercode: PHY_MST.fcustcode,
                      customerpalletid: PHY_MST.fcustpalid,
                      palletid: PHY_MST.fpalletid,
                      pcedihppvalue: pcEDIHPPValue,
                      plfoundedihpphold: plFoundEDIHPPHold,
                      plusestackhold: plUseStackHold,
                    },
                  );

                  if (result && result.output) {
                    plUseStackHold = result.output.plusestackhold !== 0;
                    plFoundEDIHPPHold = result.output.plfoundedihpphold !== 0;
                    pcEDIHPPValue = result.output.pcedihppvalue;
                  }
                  this.logger.debug(
                    { result, plFoundEDIHPPHold },
                    'INCLOSE > SP_RESULT',
                  );
                  let PhyMstFhold = PHY_MST.fhold;
                  if (plUseStackHold) {
                    await this.storedProceduresNewService.getWcsStackholdscreationandrelease(
                      {
                        holdcode: pcEDIHPPValue,
                        holdenteredby: fwho,
                        holdorrelease: 'H',
                        newholdcomment: '',
                        newstatus: '',
                        oneside: '',
                        palletorlot: 'P',
                        releasecomment: '',
                        serial: PHY_MST.fserial,
                        track: PHY_MST.ftrack,
                      },
                    );
                  } else {
                    PhyMstFhold = pcEDIHPPValue;
                  }
                  const updatephyMst = `UPDATE PHY_MST SET fishpp = 1 , fhold = '${PhyMstFhold}' WHERE id = ${PHY_MST.id};`;
                  await this.manager().query(`BEGIN ${updatephyMst}; END;`);
                }
              }
            }
            let invMstFhold = INV_MST.fhold;

            if (llLothasHPP) {
              let plUseStackHold = false;
              const [result] = await this.facilityService
                .getConnection()
                .createEntityManager()
                .query(
                  `SELECT plUseStackHold = CASE WHEN EXISTS(SELECT 1 FROM DBO.CUSTSET WHERE FCUSTCODE = '${INV_MST.fcustcode}' AND USESTACKHOLD = 1) THEN 1 ELSE 0 END;`,
                );
              if (
                result &&
                result.plUseStackHold &&
                result.plUseStackHold === true
              ) {
                plUseStackHold = true;
              }
              if (plUseStackHold === false) {
                invMstFhold = 'HPP';
              } else {
                await this.storedProceduresNewService.getWcsStackholdscreationandrelease(
                  {
                    holdcode: 'HPP',
                    holdenteredby: fwho,
                    holdorrelease: 'H',
                    newholdcomment: '',
                    newstatus: '',
                    oneside: '',
                    palletorlot: 'L',
                    releasecomment: '',
                    serial: '', // PHY_MST.fserial, // TODO check code
                    track: `${INV_MST.fbatch}${INV_MST.fsequence}`,
                  },
                );
              }
            }

            let updateMstTrn = '';
            updateMstTrn = `UPDATE INV_MST SET fpal = ${lnpals}, fqty = ${lnqty},fhold = '${invMstFhold}' WHERE id = ${INV_MST.id};`;
            updateMstTrn = `${updateMstTrn} UPDATE INV_TRN SET FPAL = ${lnpals}, FQTY = ${lnqty} WHERE FBATCH = '${INV_MST.fbatch}' AND FSEQUENCE = '${INV_MST.fsequence}';`;
            await this.manager().query(`BEGIN ${updateMstTrn}; END;`);

            // Calculate Weights!
            const CODE2 = await this.code2Repo().findOne({
              fcustcode: INV_MST.fcustcode,
              fprodgroup: INV_MST.fprodgroup,
              fproduct: INV_MST.fproduct,
              fowner: INV_MST.fowner,
              fsuplrprod: INV_MST.fsuplrprod,
            });
            let lnWgt2 = 0;
            let lnWgt1 = 0;

            if (CODE2) {
              let lciscwgt = 'N';
              if (
                CODE2 &&
                CODE2.fcatchwgt &&
                (CODE2.fcatchwgt === 'I' || CODE2.fcatchwgt === 'B')
              ) {
                lciscwgt = 'Y';
              }
              this.logger.debug(
                {
                  lnWgt2,
                  lnWgt1,
                  code2: CODE2,
                  lciscwgt,
                },
                'inclose > calculating weights',
              );
              // Get Total Net Weight
              if (lciscwgt === 'Y') {
                const PHY_DET = await this.phyDetRepo().find({
                  fbatch: INV_MST.fbatch,
                  fsequence: INV_MST.fsequence,
                });
                if (PHY_DET && PHY_DET.length > 0) {
                  const phyDetLnWgt = await this.manager().query(
                    `select sum(fnetwgt) as lnWgt2 from PHY_DET where fbatch = '${INV_MST.fbatch}' and fsequence = '${INV_MST.fsequence}'`,
                  );
                  lnWgt2 = phyDetLnWgt && phyDetLnWgt[0].lnWgt2;
                  lnWgt1 = lnWgt2 + CODE2.ftare * lnqty;
                } else {
                  lnWgt1 = CODE2.fgrosswgt * lnqty;
                  lnWgt2 = CODE2.fnetwgt * lnqty;
                }
              } else {
                lnWgt1 = CODE2.fgrosswgt * lnqty;
                lnWgt2 = CODE2.fnetwgt * lnqty;
              }
            }

            this.logger.debug(
              {
                lnWgt2,
                lnWgt1,
                fbatch: INV_MST.fbatch,
                fsequence: INV_MST.fsequence,
                code2: CODE2,
              },
              'inclose > calculated weights',
            );

            let updateInvMstInvTrn = '';
            updateInvMstInvTrn = `UPDATE INV_TRN SET FGROSSWGT = ${lnWgt1}, FNETWGT = ${lnWgt2} WHERE  FBATCH = '${INV_MST.fbatch}' AND FSEQUENCE = '${INV_MST.fsequence}';`;
            updateInvMstInvTrn = `${updateInvMstInvTrn} UPDATE INV_MST SET fgrosswgt = ${lnWgt1}, fnetwgt = ${lnWgt2}, fo_qty = ${lnqty}, fo_groswgt = ${lnWgt1}, fo_netwgt = ${lnWgt2}, fo_cube = ${INV_MST.fcube}, fo_pal = ${lnpals} WHERE id =  ${INV_MST.id} ;`;
            invMstfoQty = lnqty;
            await this.manager().query(`BEGIN ${updateInvMstInvTrn}; END;`);

            this.logger.debug(
              {
                invId: INV_TRN.id,
                mstId: INV_MST.id,
                lnqty,
                trnFqty: lnqty,
                mstFqty: lnqty,
                foQty: lnqty,
              },
              'INCLOSE > INV_TRN > INV_MST',
            );
            if (lnqty === 0) {
              delInvTrnIds =
                delInvTrnIds === ''
                  ? `${INV_TRN.id}`
                  : `${delInvTrnIds}, ${INV_TRN.id}`;
            }
          }
          if (invMstfoQty === 0) {
            delInvMstIds =
              delInvMstIds === ''
                ? `${INV_MST.id}`
                : `${delInvMstIds}, ${INV_MST.id}`;
          }
        }
      }

      if (delPhyMstIds?.length > 0) {
        this.logger.debug({ delPhyMstIds }, 'INCLOSE > `Deleting from PHY_MST');
        const deletePhyMst = `DELETE FROM PHY_MST WHERE id IN (${delPhyMstIds}); `;
        await this.manager().query(`BEGIN ${deletePhyMst}; END;`);
      }
      if (delPhyTrnIds?.length > 0) {
        this.logger.debug({ delPhyTrnIds }, 'INCLOSE > `Deleting from PHY_TRN');
        const deletePhyTrn = `DELETE FROM PHY_TRN WHERE id IN (${delPhyTrnIds}); `;
        await this.manager().query(`BEGIN ${deletePhyTrn}; END;`);
      }

      if (delInvTrnIds?.length > 0) {
        this.logger.debug({ delInvTrnIds }, 'INCLOSE > `Deleting from INV_TRN');
        const deleteInvTrn = `DELETE FROM INV_TRN WHERE id IN (${delInvTrnIds}); `;
        await this.manager().query(`BEGIN ${deleteInvTrn}; END;`);
      }

      if (delInvMstIds?.length > 0) {
        this.logger.debug({ delInvMstIds }, 'INCLOSE > `Deleting from INV_MST');
        const deleteInvMst = `DELETE FROM INV_MST WHERE id IN (${delInvMstIds}); `;
        await this.manager().query(`BEGIN ${deleteInvMst}; END;`);
      }

      // * Done Updating The INV_MST Records - Update LOADIN
      const INVMST = await this.manager().query(
        `SELECT sum(fqty) as fqty, sum(FGROSSWGT) as fgrosswgt from INV_MST where FBATCH = '${recvo.lc_batch}';`,
      );
      if (LOADIN) {
        LOADIN.fscanstat = 'R';
        if (
          INVMST &&
          INVMST.length > 0 &&
          INVMST[0]?.fqty &&
          INVMST[0]?.fgrosswgt
        ) {
          LOADIN.fcheckqty = INVMST[0].fqty;
          LOADIN.fcheckgros = INVMST[0].fgrosswgt;
        } else {
          LOADIN.fcheckqty = 0;
          LOADIN.fcheckgros = 0;
        }
        LOADIN.fscanentme = this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');
        LOADIN.fscanendte = new Date(this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD'));
        LOADIN.ffinishdte = new Date(this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD'));
        LOADIN.ffinishtme = this.facilityService.getFacilityCurrentDateTimeFormatted('HHmm');
        this.logger.debug({ INVMST, LOADIN }, 'INCLOSE > Updating LOADIN');
        await this.manager().query(
          `BEGIN
              UPDATE LOADIN set fscanstat=@1, fcheckqty=@2, fcheckgros=@3, fscanentme=@4, fscanendte=@5, ffinishdte=@6, ffinishtme=@7 WHERE id=@0;
            END;
          `,
          [
            LOADIN.id,
            LOADIN.fscanstat,
            LOADIN.fcheckqty,
            LOADIN.fcheckgros,
            LOADIN.fscanentme,
            LOADIN.fscanendte,
            LOADIN.ffinishdte,
            LOADIN.ffinishtme,
          ],
        );

        if (LOADIN.fconfirmnm.trim().length > 0) {
          const ICONFIRMresult = await this.manager().query(
            `SELECT id, ffinish, TRIM(fmbol) fmbol, TRIM(flivedrop) flivedrop, reusetrailer from ICONFIRM where fmbol = '${LOADIN.fconfirmnm}';`,
          );
          const ICONFIRM: Iconfirm = ICONFIRMresult[0];
          let nextDay = '';
          if (LOADIN.fbdate && LOADIN.fconfirmnm.trim()) {
            nextDay = `${moment(LOADIN.fbdate).format('YYYYMMDD')}${
              LOADIN.fconfirmnm
            }`;
          }
          if (ICONFIRM && ICONFIRM.id > 0 && nextDay.trim().length > 0) {
            const d =
              LOADIN.ffinishdte !== null
                ? LOADIN.ffinishdte
                : this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
            const t =
              LOADIN.ffinishtme?.trim()?.length > 0
                ? moment(LOADIN.ffinishtme, 'HHmm').format('HH:mm')
                : this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');
            const ltDtetme = moment(`${d} ${t}`, 'YYYY-MM-DD HH:mm');
            const ffinishStr = ICONFIRM?.ffinish
              ? moment(ICONFIRM.ffinish, 'YYYY-MM-DD HH:mm:ss.SSS').format(
                'YYYY-MM-DD HH:mm',
              )
              : this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm');

            const iconfirmFFinish =
              ICONFIRM?.ffinish && ffinishStr?.trim()?.length > 0
                ? moment(ffinishStr, 'YYYY-MM-DD HH:mm')
                : moment().tz(timeZoneIANA);

            const result = (iconfirmFFinish.diff(ltDtetme) < 0
              ? ltDtetme
              : iconfirmFFinish
            ).format('YYYY-MM-DD HH:mm:ss.SSS');
            ICONFIRM.ffinish = result;

            this.logger.debug(
              { LOADIN, ICONFIRM },
              'INCLOSE > Updating ICONFIRM',
            );
            await this.manager().query(
              `BEGIN UPDATE ICONFIRM set ffinish=@1 WHERE id=@0; END;`,
              [ICONFIRM.id, ICONFIRM.ffinish],
            );
            const loadinRes = await this.manager().query(
              `BEGIN SELECT id, fconfirmnm, fshipstat  from loadin WHERE fconfirmnm=@0 and fshipstat != 'Y'; END;`,
              [ICONFIRM.fmbol],
            );
            if (loadinRes && loadinRes.length > 0) {
              for (const LOADINDATA of loadinRes) {
                const idate = ICONFIRM.ffinish
                  ? moment(ICONFIRM.ffinish, 'YYYY-MM-DD HH:mm:ss.SSS')
                  : moment().tz(timeZoneIANA);
                LOADINDATA.ffinishdte = idate.format('YYYY-MM-DD');
                LOADINDATA.ffinishtme = idate.format('HHmm');

                this.logger.debug(
                  { ICONFIRM, LOADINDATA },
                  'INCLOSE > Updating LOADIN ffinishdte & ffinishtme',
                );
                await this.manager().query(
                  ` BEGIN UPDATE LOADIN set ffinishdte=@1, ffinishtme=@2 WHERE id=@0; END;`,
                  [LOADINDATA.id, LOADINDATA.ffinishdte, LOADINDATA.ffinishtme],
                );
              }
            }

            if (ICONFIRM.flivedrop === 'D' && ICONFIRM.reusetrailer === false) {
              this.logger.debug(
                { ICONFIRM },
                'INCLOSE > Executing SP getYmsMoveToYard',
              );
              const resultyms = await this.storedProceduresNewService.getYmsMoveToYard(
                {
                  inConfirmationNumber: ICONFIRM.fmbol,
                  outputJson: '',
                },
              );

              const pcJSON: string =
                resultyms && resultyms.output && resultyms.output.output_json
                  ? resultyms.output.output_json.toString()
                  : '';
              await this.apiExternalPostService.execute(
                fwho,
                'YMS',
                'MoveToYard',
                pcJSON,
              );
            }
            // ** Attempt to AutoReceive Confirmation **
            await this.storedProceduresNewService.getRfAutoreceiveinbound({
              batch: recvo.lc_batch,
              userid: fwho,
            });
          }
        }
      }
    }

    // ** Run RFEXPINV update of weights on the inbound.  Call does all the customer checks. - M1X-5774
    await this.storedProceduresNewService.getRfUpdateinvmstbyrfexpinv({
      inLookup: recvo.lc_batch,
      inType: 'B',
    });

    if (recvo.llQuickrcv) {
      // TODO: OUTCLOSE is not refactored. Still lot of TypeORM save calls in it.
      await this.OUTCLOSE(recvo);
    }
    this.logger.debug(
      { service: ReceivingService.name, curOper: recvo.curOper, fwho },
      `receiving --> INCLOSE | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')}`,
    );
  }

  async processBatch(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const startTime = moment();
    const scrnUI = [];
    this.logger.debug(
      `receiving --> processBatch | Start time ${moment().format(
        'HH:mm:ss-SSS',
      )} |  ${fwho} | ${recvo.curOper}`,
      ReceivingService.name,
    );
    if (!recvo?.CONFIG) {
      const configData = await this.globalizationService.getFacilityConfigNew();
      recvo.CONFIG = configData;
    }

    let plMultiReceiver: boolean = false;
    plMultiReceiver = recvo?.CONFIG
      ? recvo.CONFIG?.allowMultipleReceivers
      : plMultiReceiver;
    recvo.plMultiReceiver = plMultiReceiver;
    recvo.interDate = recvo?.CONFIG?.InternationalDate ?? false;

    let llBatch: boolean = false;
    recvo.ll_yrFormatSet = false;
    let lcOutbatch = '';
    let llQuickrcv: boolean = false;
    let llIntrucktotruck: boolean = false;
    let llIntruckstage: boolean = false;
    let llIsConsCross: boolean = false;

    let lcBatch = '';
    if (body.batNo) {
      lcBatch = body.batNo
        .toString()
        .trim()
        .toUpperCase()
        .padEnd(7, ' ');
      recvo.lc_batch = lcBatch;
    }

    let errMsg: string = '';
    let data = {};
    if (recvo.dynBat !== '' && lcBatch !== '' && recvo.dynBat !== lcBatch) {
      errMsg = constant.BATCH_NO_ASSIGNED;
    } else if (lcBatch === '') {
      errMsg = constant.BATCH_EMPTY;
    } else {
      const LOADINresult = await this.manager().query(
        `BEGIN
          SELECT top 1 id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate, floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse, ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted, ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi, fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, TRIM(fscanwho) as fscanwho, fscanstdte, fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort, fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment, fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop, fschcoment, fsignintme, fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust, fgroupcode, fcpc, fconsignor, TRIM(foutbatch) foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched, fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid, ftmsresend, cancelled
          FROM dbo.Loadin WHERE fbatch = '${lcBatch}' order by fbatch ASC ;
        END`,
      );
      const LOADIN: Loadin = LOADINresult[0];
      const carrier = await this.manager().query(
        `SELECT TOP 1 LineageFreightManagement FROM CARRIER WHERE FCUSTCODE = '${LOADIN?.fcarrier}'`,
      );
      recvo.lineageFreightManagement =
        carrier && carrier.length > 0
          ? carrier[0].LineageFreightManagement
          : false;
      const quickRec = await this.manager().query(
        `SELECT TOP 1 TRIM(fquickrcv) as fquickrcv FROM QUICKREC WHERE FINBATCH ='${recvo?.lc_batch}'`,
      );
      recvo.quickRec = quickRec ? quickRec[0] : {};

      if (LOADIN) {
        if (
          (LOADIN.fscanstat !== 'P' && plMultiReceiver === false) ||
          plMultiReceiver === true
        ) {
          if (LOADIN.fshipstat !== 'Y') {
            if (!(LOADIN.finuse === 'Y')) {
              if (LOADIN.fscanstat !== 'R') {
                // Show the message to user if quickrcv is L,D,S
                if (recvo.curOper === ReceivingState.MARK_PROCESS_BATCH) {
                  let notes;
                  let fQRcv;
                  let mergedNotes = '';
                  if (LOADIN.fcustcode && LOADIN.fconsignor.trim() !== '') {
                    // Get notes from stored procedure
                    const spResult = await this.storedProcedureService.getRfShowcustomerconsigneenotes({
                      lcconsig: LOADIN.fconsignor.trim().replace('/', ''),
                      lccustomer: LOADIN.fcustcode,
                      lctype: 'RECV',
                      lnheight: 4
                    });

                    // Get fQRcv
                    // First, declare the variable with type
                    let fQRcv: string;

                    // Then assign the value
                    fQRcv = await this.facilityService
                      .getConnection()
                      .getRepository(Quickrec)  // Use QuickRec entity, not fQRcv
                      .createQueryBuilder('qr')
                      .select('qr.FQUICKRCV', 'fQRcv')
                      .where('qr.FINBATCH = cast(:fbatch as char(7))', {
                        fbatch: LOADIN.fbatch
                      })
                      .getRawOne()
                      .then(result => result?.fQRcv || '');


                    // Process and merge notes
                    let mergedNotes = '';
                    if (spResult?.recordset && Array.isArray(spResult.recordset)) {
                      mergedNotes = spResult.recordset
                        .map(item => item.NOTE)
                        .filter(Boolean)
                        .join(' ')
                        .replace(/\n/g, ' ')
                        .trim();
                    }
                    // Create curNotes with the merged note
                    const curNotes = [{
                      note: mergedNotes,
                      fQRcv: fQRcv.trim()
                    }];
                    // Set final values
                    notes = mergedNotes;
                    fQRcv = curNotes[0].fQRcv;

                    if (curNotes && curNotes.length > 0) {
                      // merge all the notes into single string
                      mergedNotes = curNotes
                        .map((curNote: any) => curNote.note)
                        .join('');
                    }
                    notes =
                      mergedNotes && mergedNotes.trim().length > 0
                        ? mergedNotes
                        : curNotes[0]?.note || '';
                    fQRcv = curNotes[0]?.fQRcv ?? '';
                  } else if (
                    LOADIN.fcustcode &&
                    LOADIN.fconsignor.trim() === ''
                  ) {
                    const curNotes = await this.manager()
                      .query(
                        `BEGIN
                    DECLARE @curNotes TABLE (FLINE int, NOTE varchar(38));
                    DECLARE @fQRcv char(1);
                    INSERT INTO @curNotes EXEC [dbo].[usp_RF_ShowCustomerConsigneeNotes]
                    @lcCustomer = '${LOADIN.fcustcode}',
                    @lcConsig = '',
                    @lcType = 'RECV',
                    @lnHeight  = 4;
                    SELECT top 1 @fQRcv = FQUICKRCV FROM QUICKREC WHERE FINBATCH ='${LOADIN.fbatch}';
                    SELECT note, @fQRcv as fQRcv FROM @curNotes;
                    END`,
                      )
                      .catch(error => {
                        this.logger.error(
                          {
                            fcustcode: LOADIN.fcustcode,
                            fconsignor: LOADIN.fconsignor,
                          },
                          'Error in curNotes',
                          'RECEIVING > PROCESS_BATCH',
                        );
                        throw error;
                      });
                    if (curNotes && curNotes.length > 0) {
                      // merge all the notes into single string
                      mergedNotes = curNotes
                        .map((curNote: any) => curNote.note)
                        .join('');
                    }
                    notes =
                      mergedNotes && mergedNotes.trim().length > 0
                        ? mergedNotes
                        : curNotes[0]?.note || '';
                    fQRcv = curNotes[0]?.fQRcv ?? '';
                  }
                  if (!notes && fQRcv && fQRcv?.trim().length > 0) {
                    const rcvType = fQRcv;
                    const notesData: Record<string, string> = {
                      L: constant.LEAVE_ON_TRUCK,
                      D: constant.STORE_ON_DOCK,
                      S: constant.STORE_IN_FREEZER,
                    };
                    notes = notesData[rcvType] || '';
                  }
                  if (notes) {
                    recvo.curOper = ReceivingState.MARK_SHOW_NOTES;
                    await this.cacheService.setcache(fwho, RECEIVING, recvo);
                    return new ResponseKeysDTO(
                      plainToClass(PostResponseReceivingDTO, {
                        errMsg,
                        infoMsg: '',
                        curOper: recvo.curOper,
                        data: notes,
                        label: 'Notes',
                      }),
                      getOutFieldState(recvo.curOper),
                      '',
                      '',
                      `${constant.F5_EXIT}`,
                    );
                  }
                }
                if (LOADIN.fscanwho === '') {
                  await this.INBDEL(recvo);
                }

                let loadingUpdateSet = '';
                LOADIN.fscanstat = 'P';
                LOADIN.fscanwho =
                  LOADIN.fscanwho && LOADIN.fscanwho !== ''
                    ? LOADIN.fscanwho
                    : fwho;
                loadingUpdateSet = `fscanstat = '${LOADIN.fscanstat}', fscanwho = '${LOADIN.fscanwho}'`;
                let updateLoadin = '';
                if (!(LOADIN.fscanstdte && LOADIN.fscanstdte !== null)) {
                  LOADIN.fscanstdte = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss:SSS') as unknown as Date;
                  LOADIN.fstarttme = this.facilityService.getFacilityCurrentDateTimeFormatted('HHmm');
                  LOADIN.fstartdte = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD') as unknown as Date;
                  loadingUpdateSet = `${loadingUpdateSet}, fscanstdte = '${LOADIN.fscanstdte}', fstarttme = '${LOADIN.fstarttme}', fstartdte = '${LOADIN.fstartdte}'`;
                }
                updateLoadin = `UPDATE LOADIN SET ${loadingUpdateSet} WHERE ID = '${LOADIN.id}';`;

                if (recvo.dynBat?.length > 0) {
                  await this.facilityService
                    .getConnection()
                    .query(
                      `BEGIN Update r set fwho = '${fwho}' From RECEIVING r Inner Join LOADIN li on li.fbatch = r.fbatch Inner Join LOADIN li2 on li2.fconfirmnm = li.fconfirmnm and li2.fbatch = '${recvo.dynBat}'; END`,
                    );
                }

                const batchQueryres = await this.manager()
                  .query(
                    `BEGIN
                    Declare @fcustcode char(20), @batch char(7), @fmbol char(10), @loadinfout char(7);
                    SET @fcustcode = '${LOADIN.fcustcode}'; SET @batch = '${LOADIN.fbatch}'; SET @fmbol = '${LOADIN.fconfirmnm}'; SET @loadinfout = '${LOADIN.foutbatch}';

                    DECLARE @idIconfrim int = 0, @idLoadout int = 0, @fstart DATETIME, @fquickrcv char(1), @foutbatch char(7), @fscansttme char(5), @fscanendte DATE
                    SELECT TOP 1 @idIconfrim = id, @fstart = fstart FROM ICONFIRM WHERE FMBOL = @fmbol order by FMBOL ASC;


                    SELECT  @fquickrcv = fquickrcv, @foutbatch = foutbatch from QUICKREC WHERE finbatch = @batch order by finbatch ASC ;
                    SELECT TOP 1 @idLoadout = id, @fscansttme = fscansttme, @fscanendte = fscanendte from LOADOUT WHERE FBATCH = @batch order by FBATCH ASC ;

                    DECLARE @fstate char(2), @fusemetric bit, @ffulpalchg int, @fglfulpal char(10), @fstatus char(6), @customerId INT
                    SELECT TOP 1 @fstate = fstate, @fusemetric = fusemetric, @ffulpalchg = ffulpalchg, @fglfulpal = fglfulpal, @fstatus = fstatus, @customerId = id
                    FROM dbo.CUSTOMER WHERE fcustcode = @fcustcode order by fcustcode ASC ;

                    DECLARE @fltcustlt char(1), @fpmcpalt char(1), @fhasblast char(1), @fgetpalwgt BIT, @custReqId int
                    SELECT TOP 1 @fltcustlt = fltcustlt, @fpmcpalt = fpmcpalt, @fhasblast = fhasblast, @fgetpalwgt = fgetpalwgt, @custReqId = id
                    FROM dbo.CUSTREQ q WHERE fcustcode = @fcustcode order by fcustcode ASC ;

                    DECLARE @fedistatbp BIT, @fediblstst char(1), @futureDate BIT, @autodateforprodlot BIT, @palMaxLength int,  @validatePaLLength BIT, @fcdt2Back BIT, @ffuturedte BIT, @HandKeyConsigneeCross BIT, @ibRotationRestriction BIT, @AllowReceiverPutAway bit
                    SELECT TOP 1 @fedistatbp = fedistatbp, @fediblstst = TRIM(fediblstst), @futureDate = FUTURE_DATE , @autodateforprodlot = autodateforprodlot, @ibRotationRestriction = ibRotationRestriction,
                    @palMaxLength = PAL_MAX_LENGTH, @validatePaLLength = VALIDATE_PAL_LENGTH, @fcdt2Back = fcdt2Back, @ffuturedte = ffuturedte, @HandKeyConsigneeCross = HandKeyConsigneeCross, @AllowReceiverPutAway = AllowReceiverPutAway
                    FROM dbo.CUSTSET WHERE fcustcode = @fcustcode order by fcustcode ASC ;

                    ${updateLoadin}

                    SELECT
                    @idIconfrim idIconfrim, @idLoadout idLoadout, @fstart fstart, TRIM(@fquickrcv) fquickrcv, TRIM(@foutbatch) foutbatch,
                    TRIM(@fscansttme) fscansttme, @fscanendte fscanendte,
                    TRIM(@fstate) fstate, @fusemetric fusemetric, @ffulpalchg ffulpalchg, TRIM(@fglfulpal) fglfulpal,
                    @fltcustlt fltcustlt, @fpmcpalt fpmcpalt, @fhasblast fhasblast, @fgetpalwgt fgetpalwgt, @ibRotationRestriction ibRotationRestriction,
                    @fedistatbp fedistatbp, @fediblstst fediblstst, @futureDate futureDate, @autodateforprodlot autodateforprodlot, @palMaxLength palMaxLength, @validatePaLLength validatePaLLength, @fcdt2Back fcdt2Back, @ffuturedte ffuturedte, @HandKeyConsigneeCross HandKeyConsigneeCross,
                    @customerId as customerId, @fstatus as fstatus, @custReqId as custReqId, @AllowReceiverPutAway AllowReceiverPutAway

                  END`,
                  )
                  .catch(error => {
                    this.logger.error(
                      {
                        fcustcode: LOADIN.fcustcode,
                        batch: LOADIN.fbatch,
                        fmbol: LOADIN.fconfirmnm,
                        loadinfout: LOADIN.foutbatch,
                      },
                      'Error in ICONFIRM/QUICKREC/CUSTSET/CUSTREQ fetch Queries',
                      'RECEIVING > PROCESS_BATCH',
                    );
                    throw error;
                  });
                const result: LoadinBatch = batchQueryres[0];
                this.logger.debug(
                  `receiving --> processBatch |  ${fwho} | ${JSON.stringify(
                    result,
                  )}`,
                  ReceivingService.name,
                );
                if (LOADIN.fconfirmnm.trim() !== '' && result) {
                  if (result.fstart && result.fstart !== null) {
                    LOADIN.fstartdte = moment(result.fstart).format(
                      'YYYY-MM-DD',
                    );

                    LOADIN.fstarttme = moment(result.fstart).format('HHmm');
                    const updateLoadin = `BEGIN UPDATE LOADIN SET fstartdte = '${LOADIN.fstartdte}', fstarttme = '${LOADIN.fstarttme}' 
                      WHERE ID = '${LOADIN.id}' END;`;
                    await this.manager().query(updateLoadin);
                  } else {
                    let fstart = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS');
                    if (
                      LOADIN &&
                      LOADIN.fstartdte &&
                      LOADIN.fstarttme &&
                      LOADIN.fstartdte !== null &&
                      LOADIN.fstarttme !== null &&
                      moment(LOADIN.fstartdte, 'YYYY-MM-DD').isValid() &&
                      LOADIN.fstarttme.trim().length > 0
                    ) {
                      fstart = moment(
                        `${moment(LOADIN.fstartdte).format('YYYY-MM-DD')}${
                          LOADIN.fstarttme
                        }`,
                        'YYYY-MM-DDHHmm',
                      ).format('YYYY-MM-DD HH:mm:ss.SSS');
                    } else if (
                      LOADIN &&
                      LOADIN.fstartdte &&
                      LOADIN.fstartdte !== null &&
                      moment(LOADIN.fstartdte, 'YYYY-MM-DD').isValid()
                    ) {
                      fstart = moment(LOADIN.fstartdte, 'YYYY-MM-DD').format(
                        'YYYY-MM-DD HH:mm:ss.SSS',
                      );
                    }
                    await this.manager().query(
                      `BEGIN UPDATE ICONFIRM SET FSTART = '${fstart}' WHERE ID =${result.idIconfrim} ;END`,
                    );
                  }
                }
                // const CUSTOMERresult = await this.manager().query(
                //   `BEGIN
                //     SELECT TOP 1 id, fstate, fusemetric, ffulpalchg, fglfulpal
                //     FROM dbo.CUSTOMER WHERE fcustcode = '${LOADIN.fcustcode}' order by fcustcode ASC ;
                //   END`,
                // );
                // const CUSTOMER: Customer = CUSTOMERresult[0];
                if (result && result?.customerId) {
                  recvo.lc_status = result.fstatus;
                  recvo.ll_usemetric = result.fusemetric === true;
                  recvo.ln_fulpalchg = result.ffulpalchg;
                  recvo.lc_fulpalgl = result.fglfulpal;
                } else {
                  recvo.ln_fulpalchg = 0;
                  recvo.lc_fulpalgl = '';
                }

                if (recvo?.CONFIG) {
                  if (LOADIN.foutbatch !== '') {
                    if (
                      recvo.CONFIG?.fquickbatch &&
                      LOADIN.fbatch &&
                      result &&
                      result.foutbatch === LOADIN.foutbatch
                    ) {
                      llIntrucktotruck = true;
                      if (result && result.fquickrcv?.trim() === 'T') {
                        llIntruckstage = true;
                      }
                    }
                    if (result && result.idLoadout > 0) {
                      const fscansttme =
                        result.fscansttme && result.fscansttme !== undefined
                          ? result.fscansttme
                          : this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm')
                      const fscanendte =
                        result.fscanendte && result.fscanendte !== undefined
                          ? result.fscanendte
                          : this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD')
                      await this.manager().query(`BEGIN
                        UPDATE LOADOUT SET
                          fscansttme = '${fscansttme}',
                          fscanendte = '${fscanendte}',
                          fscanstat = 'S'
                          WHERE ID = '${result.idLoadout}';
                        END
                      `);
                      // await this.loadoutRepo().save({
                      //   fscansttme:
                      //     result.fscansttme && result.fscansttme !== undefined
                      //       ? result.fscansttme
                      //       : new Date().toTimeString(),
                      //   fscanendte:
                      //     result.fscanendte && result.fscanendte !== undefined
                      //       ? result.fscanendte
                      //       : new Date(),
                      //   fscanstat: 'S',
                      // });
                    }
                    lcOutbatch = LOADIN.foutbatch;
                    llQuickrcv = true;
                  } else {
                    if (
                      recvo?.CONFIG?.fquickbatch &&
                      result &&
                      result.fquickrcv?.trim() === 'C'
                    ) {
                      llIsConsCross = true;
                    }
                    lcOutbatch = '';
                    llQuickrcv = false;
                  }
                  llBatch = true;

                  if (llBatch) {
                    recvo.llQuickrcv = llQuickrcv;
                    recvo.lcOutbatch = lcOutbatch;
                    recvo.ll_isConsCross = llIsConsCross;
                    recvo.ll_intrucktotruck = llIntrucktotruck;
                    recvo.ll_intruckstage = llIntruckstage;
                    recvo.LOADIN = LOADIN;
                    recvo.lc_hasbox = 'N';
                    recvo.lc_hascust = 'N';
                    recvo.lc_haslot = 'N';
                    recvo.lc_keylot = 'N';
                    recvo.lc_keyestb = 'N';
                    recvo.lc_keyref = 'N';
                    recvo.lc_keytmp = 'N';
                    recvo.lc_hasblast = 'N';
                    recvo.ln_oldtie = 0;
                    recvo.ln_oldhigh = 0;

                    recvo.lc_CustCode = recvo.LOADIN.fcustcode;
                    // const CUSTREQresult = await this.manager().query(
                    // const [custset] = await this.manager().query(
                    //   `SELECT AllowReceiverPutAway FROM CUSTSET WHERE FCUSTCODE = '${recvo.LOADIN?.fcustcode}'`,
                    // );
                    recvo.allowReceiverPutAway =
                      result && result.AllowReceiverPutAway
                        ? result.AllowReceiverPutAway
                        : false;

                    //   `BEGIN
                    //     SELECT TOP 1 id, fltcustlt, fpmcpalt, fhasblast, fgetpalwgt
                    //     FROM dbo.CUSTREQ WHERE fcustcode = '${LOADIN.fcustcode}' order by fcustcode ASC ;
                    //   END`,
                    // );
                    // const CUSTREQ: Custreq = CUSTREQresult[0];
                    if (result && result?.custReqId) {
                      recvo.lc_haslot = result?.fltcustlt === 'Y' ? 'Y' : 'N';
                      recvo.lc_hascust = result?.fpmcpalt === 'Y' ? 'Y' : 'N';
                      recvo.lc_hasblast = result?.fhasblast === 'Y' ? 'Y' : 'N';
                      recvo.ll_PalWgt = result?.fgetpalwgt;
                    }

                    /**
                     * New code added for ecert to get all rf versions
                     */
                    let RFREQ;
                    let RFREQNEW;
                    const configCheck = await this.dynamicAttributesService.configCheck(this.manager());
                    if (configCheck.length > 0 && configCheck[0]?.USE_BARCODE_SCANNING_MAINTENANCE) {
                      RFREQNEW = await this.dynamicAttributesService.getRfInfoVersions(this.manager(), recvo.LOADIN.fcustcode, recvo.LOADIN.fconsignor.trim());
                      RFREQ = RFREQNEW[0];
                    }
                    else {
                      const RFREQresult = await this.manager().query(
                        `BEGIN
                          SELECT TOP 1 id, fcustcode, fkeylot, fkeyref, fkeytemp, fscanlngth, fprodfrom,  fprodto, fdtefrom, fdteto,  fwgtfrom, fwgtto,  fboxfrom, fboxto, fscantype,  fcpal, fcpalfrom, fcpalto, fcustlot, fproduct, fcodedate,  fweight, fbox, fpallet, fcpallet, fqty, flot, fclot, fpalfrom, fpalto,  fqtyfrom, fqtyto, flotfrom, flotto,  fclotfrom, fclotto, fuse128Bar, fprodvar, fprodvfrom, fprodvto, fltestbnum, fbbdtefrom, fbbdteto, fbbcodedte, ffilllot, fdupoutbox, fhndkeywgt, fyywwdcool, fuseasnovr, fprodasn, flotasn, fdateasn, fqtyasn, fedipal, ffirstsscc, fcoolcode, fcoolcodefrom, fcoolcodeto, edipalnoqty, ALT_128_CHECK as alt128check, calcProdOrBBDate, CustomerPIDLength, AutoFillConsignee
                          FROM dbo.RFREQ WHERE fcustcode = '${LOADIN.fcustcode}' order by fcustcode ASC ;
                        END`,
                      );
                      RFREQ = RFREQresult[0];
                    }
                    let llRffnd = false;
                    if (RFREQ) {
                      llRffnd = true;
                      recvo.lc_keylot = RFREQ.fkeylot === 'Y' ? 'Y' : 'N';
                      recvo.lc_keyestb = RFREQ.fltestbnum === 'Y' ? 'Y' : 'N';
                      recvo.lc_keyref = RFREQ.fkeyref === 'Y' ? 'Y' : 'N';
                      recvo.lc_keytmp = RFREQ.fkeytemp === 'Y' ? 'Y' : 'N';
                      recvo.llUse128Barcode = RFREQ.fuse128Bar;
                      recvo.lnBarcodeScanLength = RFREQ.fscanlngth;
                      recvo.ll_yywwdcool = RFREQ.fyywwdcool
                        ? RFREQ.fyywwdcool
                        : false;
                      recvo.ll_ASNpal = RFREQ.fedipal ? RFREQ.fedipal : false;
                      recvo.ll_ASNpalNoQty = RFREQ.edipalnoqty
                        ? RFREQ.edipalnoqty
                        : false;
                      recvo.plCalcPRBBDate = RFREQ.calcProdOrBBDate;
                      recvo.ln_CustomerPIDLength = RFREQ.CustomerPIDLength;
                      recvo.plAutoFillConsignee = RFREQ.AutoFillConsignee;
                      recvo.RFREQ = RFREQ;
                      const scanInfo = {
                        lc_keylot: recvo.lc_keylot,
                        lc_keyestb: recvo.lc_keyestb,
                        lc_keyref: recvo.lc_keyref,
                        llUse128Barcode: recvo.llUse128Barcode,
                        lnBarcodeScanLength: recvo.lnBarcodeScanLength,
                        ll_yywwdcool: recvo.ll_yywwdcool,
                        ll_ASNpal: recvo.ll_ASNpal,
                        plAlt128Check: recvo.plAlt128Check,
                        ll_ASNpalNoQty: recvo.ll_ASNpalNoQty,
                      };
                      data = { RFREQ: recvo.RFREQ, scanInfo, RFREQNEW };
                    }
                    recvo.ll_rffnd = llRffnd;

                    // const CUSTSETresult = await this.manager().query(
                    //   `BEGIN
                    //     SELECT id, fedistatbp, fediblstst, FUTURE_DATE as futureDate, autodateforprodlot, PAL_MAX_LENGTH as palMaxLength, VALIDATE_PAL_LENGTH as validatePaLLength, fcdt2Back, ffuturedte
                    //     FROM dbo.CUSTSET WHERE fcustcode = '${LOADIN.fcustcode}' order by fcustcode ASC ;
                    //   END`,
                    // );
                    // const CUSTSET: Custset = CUSTSETresult[0];
                    // if (CUSTSET) {
                    recvo.ll_BatchProdEdiStatus = result.fedistatbp
                      ? result.fedistatbp
                      : false;
                    recvo.lc_EdiControlReqBlast = result.fediblstst
                      ? result.fediblstst
                      : ' ';
                    recvo.pl_future_date = result.futureDate;
                    recvo.pl_AutoDateForProdLot = result.autodateforprodlot;
                    recvo.plIBRotationRestriction =
                      result.ibRotationRestriction;
                    recvo.ln_PalMaxLength = result.palMaxLength;
                    recvo.ll_ValidatePalLength = result.validatePaLLength;
                    recvo.pnHandKeyConsigneeCross = result.HandKeyConsigneeCross
                      ? result.HandKeyConsigneeCross
                      : false;
                    recvo.ln_yearsback = result.fcdt2Back ? 2 : 1;
                    recvo.ffuturedte = result.ffuturedte
                      ? result.ffuturedte
                      : false;
                    // }

                    if (recvo.ll_intrucktotruck && !recvo.lcInMachineID) {
                      recvo.lcInMachineID = '';
                      recvo.prevCurOper =
                        ReceivingState.MARK_RECEIVING_GETMACHINEID;
                      recvo.curOper =
                        ReceivingState.MARK_RECEIVING_GETMACHINEID;
                    } else {
                      recvo.curOper = ReceivingState.MARK_PROCESS_PALLET;
                      recvo.lc_pal = '';
                      const d = getFields(ReceivingState.MARK_PROCESS_PALLET);
                      if (recvo.RFREQ && recvo.RFREQ?.fscanlngth)
                        d.maxFieldLen = recvo.RFREQ.fscanlngth;
                      scrnUI.push(d);
                    }
                    await this.cacheService.setcache(fwho, RECEIVING, recvo);
                    errMsg = '';
                    this.logger.debug(
                      `receiving --> processBatch | End time ${moment().format(
                        'HH:mm:ss-SSS',
                      )} |  ${fwho} | ${recvo.curOper}`,
                      ReceivingService.name,
                    );
                    this.logger.debug(
                      `receiving --> processBatch | Elapsed time ${moment().diff(
                        startTime,
                      )} ms | OUT Time ${moment().format(
                        'HH:mm:ss-SSS',
                      )} |  ${fwho} | ${recvo.curOper}`,
                      ReceivingService.name,
                    );
                  }
                }
              } else {
                errMsg = constant.BATCH_NO_PENDING;
              }
            } else {
              errMsg = constant.BATCH_EDIT;
            }
          } else {
            errMsg = constant.BATCH_RECEIVED;
          }
        } else {
          errMsg = constant.BATCH_SCANNED;
        }
      } else {
        errMsg = constant.BATCH_NOT_FOUND_REC;
      }
    }
    const result = new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        data,
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      recvo.curOper === ReceivingState.MARK_PROCESS_PALLET
        && recvo.lineageFreightManagement && ['L', 'D', 'S'].includes(recvo.quickRec?.fquickrcv?.trim())
        ? `${constant.F5_EXIT}`
        : `${constant.F5_EXIT}~${constant.F8_LABL}`,
    );

    return result;
  }

  getCheckSwapByLotBarcode(recvo: ReceivingVO): boolean {
    let resultbar: boolean = false;
    try {
      if (recvo.lc_pal && recvo.lc_pal.length > 4) {
        recvo.lcWorkingPid = recvo.lc_pal;
        const l = [...recvo.lcWorkingPid];
        if (
          !Number.isNaN(Number(l[0])) &&
          !Number.isNaN(Number(l[1])) &&
          !Number.isNaN(Number(l[2])) &&
          l[3] === '-'
        ) {
          recvo.lc_pal = `${recvo.lcWorkingPid.slice(
            4,
            -1,
          )}-${recvo.lcWorkingPid.slice(0, 3)}`;
          resultbar = true;
        }
      }
    } catch (error) {
      this.logger.error(
        { error, message: 'LOADIN error getCheckSwapByLotBarcode -->' },
        'Error in getCheckSwapByLotBarcode',
        ReceivingService.name,
      );
    }
    return resultbar;
  }

  async processPalletIDPrinter(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    if (body.pnInput && body.pnInput.toUpperCase() === 'F8') {
      recVO.plUsedF8 = true;
      const lcSql = `DECLARE @grpname CHAR(20) = '',
                            @custcode CHAR(20) = '',
                            @t CHAR(20);
          SELECT TOP (1)
                @custcode = [ccg].[FCUSTCODE],
                @grpname = [ccg].[GROUPNAME]
          FROM [dbo].[ConsigneeConsignorGroup] [ccg]
              INNER JOIN [dbo].[ConsigneeConsignorGroupMembers] [ccgm]
                  ON [ccg].[ID] = [ccgm].[CONSIGNEECONSIGNORGROUPID]
          WHERE [ccg].[FCUSTCODE] = @0
                AND [ccgm].[CONSIGNEE] = @1
          ORDER BY [ccg].[ID] DESC;
          EXEC [dbo].[usp_GetNextSsccLabel] @CustomerCode = @custcode,
                                            @GroupName = @grpname,
                                            @Out_SsccLabel = @t OUTPUT;
          SELECT @t AS [ReturnValue];`;
      const ssccResult = await this.manager().query(lcSql, [
        recVO.LOADIN.fcustcode,
        recVO.LOADIN.fconsignor,
      ]);
      if (ssccResult && ssccResult[0] && ssccResult[0].ReturnValue) {
        body.palNo = ssccResult[0].ReturnValue.trim();
        recVO.skipMaskValid = true;
        return this.processPalletID(fwho, body, recVO, constant);
      }
      return this.processPalletID(fwho, body, recVO, constant);
    }
    return this.processPalletID(fwho, body, recVO, constant);
  }

  async processPalletID(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    let recvo = recVO;
    let outKey = 'palletID';
    const scrnUI: Field[] = [];
    // line 412 &&& GET PALLET ID
    const LOADIN = (recvo.LOADIN as unknown) as Loadin;
    recvo.ll_yrFormatSet = false;
    if (recvo.ll_intrucktotruck && recvo.lcInMachineID === undefined) {
      recvo.lcInMachineID = '';
      recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE;
      return new ResponseKeysDTO(
        plainToClass(PostResponseReceivingDTO, {
          errMsg: '',
          infoMsg: 'LOADING',
          curOper: recvo.curOper,
        }),
      );
    }
    let lcPal: string = '';
    recvo.lc_pal = lcPal;
    // recvo.lcTempProd = '';
    // recvo.lcTempdate = '';
    // recvo.lcTempLot = '';
    // recvo.lcTempCustomerLot = '';
    recvo.lc_custpal = '';
    recvo.lc_prod = '';
    recvo.lc_CoolCode = '';
    recvo.lc_dte = '';
    recvo.lc_jdte = '';
    recvo.lc_bbdte = '';
    recvo.lc_BBJULIAN = '';
    // recvo.lC_BBCDDTE = {}
    recvo.lc_qty = '';
    recvo.plUnmatchedAsnQty = false;
    recvo.pnExpectedAsnQty = 0;
    // recvo.ln_inqty = 0;
    recvo.lc_lot = '';
    // recvo.lcTempLot = '';
    recvo.lc_clot = '';
    recvo.lc_estb = '';
    recvo.lc_slaughdte = '';
    recvo.lc_ref = '';
    recvo.lc_temp = '';
    recvo.lc_cwgt = '';
    recvo.ln_cwgt = 0;
    recvo.lc_boxnum = '';
    recvo.lc_acwt = 0;
    recvo.lc_dtetyp = '';
    recvo.ll_iscatch = false;
    recvo.lc_isblast = 'N';
    recvo.ll_isHPPin = false;
    recvo.lc_isHPP = 'N';
    recvo.ln_intie = 0;
    recvo.ln_high = 0;
    recvo.ll_usedF6 = false;
    // recvo.llPal = false;
    recvo.lc_LotPattern = '';
    recvo.ln_LotPatternStart = 0;
    recvo.pcCurProd = lcPal;

    if (body.palNo && body.palNo.trim().length > 0) {
      lcPal = body.palNo.trim().toUpperCase();

      /*** Mask Definition Validation ****/
      recvo.curOper = ReceivingState.MARK_PROCESS_PALLET;
      const maskResult = new ResponseKeysDTO(
        plainToClass(PostResponseReceivingDTO, {
          errMsg,
          infoMsg: '',
          curOper: recvo.curOper,
          scrnUI,
        }),
        getOutFieldState(recvo.curOper),
        '',
        '',
        recvo.curOper === ReceivingState.MARK_PROCESS_PALLET
          && recvo.lineageFreightManagement && ['L', 'D', 'S'].includes(recvo.quickRec?.fquickrcv?.trim())
          ? `${constant.F5_EXIT}`
          : `${constant.F5_EXIT}~${constant.F8_LABL}`,
      );
      const maskDefValid = await this.validateMaskDefinitionService.palletMaskDefinition<
        PostResponseReceivingDTO,
        ReceivingVO
      >(
        maskResult,
        recvo.LOADIN.fcustcode,
        lcPal,
        MaskingTypeEnum.PALLETID,
        recvo,
        ModuleNameEnum.RECEIVE,
      );
      if (maskDefValid) {
        return maskDefValid;
      }

      recvo.lc_pal = lcPal;
      const RFREQ = (recvo.RFREQ as unknown) as Rfreq;
      if (recvo.lc_hascust === 'Y' && recvo.ll_rffnd && RFREQ.fcpal === 'Y') {
        recvo.lc_custpal = lcPal;
      }
      lcPal = lcPal.toString().trim();
      if (recVO.plUsedF8) {
        const d = getFields(ReceivingState.MARK_PROCESS_PALLET);
        d.defaultVal = lcPal;
        d.value = lcPal;
        d.readable = true;
        d.editable = false;
        if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
          d.maxFieldLen = recvo.RFREQ.fscanlngth;
        scrnUI.push(d);
      }
      if (this.getCheckSwapByLotBarcode(recvo) === false) {
      } else if (
        recvo.ll_rffnd &&
        RFREQ &&
        (RFREQ.fpalfrom > 0 || RFREQ.fpalto > 0)
      ) {
        lcPal = lcPal.slice(RFREQ.fpalfrom, lcPal.length - RFREQ.fpalto);
      } else {
        lcPal = recvo.lc_pal;
      }
      let llPal = false;
      if (lcPal.length > 0) {
        if (recvo.ll_yywwdcool && lcPal.trim().length >= 6) {
          recvo.lc_dte = lcPal.slice(1, 5);
          recvo.lc_CoolCode = lcPal.slice(1, 6);
        }
        if (
          recvo.ll_ValidatePalLength &&
          lcPal.trim().length > recvo.ln_PalMaxLength
        ) {
          errMsg = constant.PID_LONG;
        } else {
          if (recvo.plMultiReceiver) {
            const LOADIN1result = await this.manager().query(
              `BEGIN
                SELECT TOP 1 id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate, floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse, ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted, ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi, fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, fscanwho, fscanstdte, fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort, fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment, fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop, fschcoment, fsignintme, fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust, fgroupcode, fcpc, fconsignor, foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched, fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid, ftmsresend, cancelled
                FROM dbo.Loadin WHERE fbatch = '${recvo.lc_batch.padStart(
                  7,
                  '0',
                )}' order by fbatch ASC ;
              END`,
            );
            const LOADIN1: Loadin = LOADIN1result[0];
            if (LOADIN1 && LOADIN1.fscanstat) {
              recvo.pcMultiRecScanStat = LOADIN1.fscanstat;
            }
            if (recvo.pcMultiRecScanStat === 'R') {
              recvo.curOper = ReceivingState.MARK_RECEIVING_CLOSE_P;
              await this.cacheService.setcache(fwho, RECEIVING, recvo);

              const c = getFields(ReceivingState.MARK_RECEIVING_CLOSE_P);
              scrnUI.push(c);
              return new ResponseKeysDTO(
                plainToClass(PostResponseReceivingDTO, {
                  curOper: recvo.curOper,
                  errMsg: '',
                  infoMsg: '',
                  infoMsg2: constant.DATA_NOT_SENT,
                  scrnUI,
                }),
                getOutFieldState(recvo.curOper),
                '',
                '',
                `${constant.F5_EXIT}`,
              );
            }
          }

          const date = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
          const time = this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');
          const phyMstBatchQuery = `BEGIN
              DECLARE @id int, @fpalletid char(20), @fcustpalid char(20), @fshipstat char(1), @fqty numeric(6,0), @ftrack char(10), @frectype char(1), @return_value int, @out_FPALLETID char(20), @out_Response varchar(2000);
              EXEC @return_value = dbo.usp_mrs_rf_RenameLPN @In_LPN = '${lcPal}', @out_FPALLETID = @out_FPALLETID OUTPUT, @out_Response = @out_Response OUTPUT;
              SELECT TOP 1 @id = id, @fpalletid = TRIM(fpalletid), @fcustpalid = TRIM(fcustpalid), @fshipstat = fshipstat, @fqty = fqty, @ftrack = ftrack, @frectype = frectype FROM dbo.PHY_MST
              WHERE fpalletid = '${lcPal}' order by fpalletid ASC ;
              SELECT @id id, @fpalletid fpalletid, @fcustpalid fcustpalid, @fshipstat fshipstat, @fqty fqty, @ftrack ftrack, @frectype frectype, @out_FPALLETID as 'pcFPALLETID', @out_Response as 'pcmessage';
            END`;
          let pcmessage = '';
          let pcFPALLETID = ''; // added code according to V19
          let PHY_MST;
          const [phyMstBatchQueryRes] = await this.manager()
            .query(phyMstBatchQuery)
            .catch(error => {
              this.logger.error(
                { fpalletid: lcPal },
                'Error in PHY_MST fetch Query',
                'RECEIVING > PROCESS_PALLET_ID',
              );
              throw error;
            });
          if (phyMstBatchQueryRes) {
            pcFPALLETID = phyMstBatchQueryRes?.pcFPALLETID ?? '';
            if (pcFPALLETID && pcFPALLETID?.trim()?.length > 0) {
              lcPal = pcFPALLETID.trim();
            }
            pcmessage = phyMstBatchQueryRes?.pcmessage?.trim() ?? '';
            PHY_MST = phyMstBatchQueryRes;
          }
          if (pcmessage === 'NOT SHIPPED') {
            // PHY_MST = await this.phymstRepo().findOne({
            //   where: {
            //     fpalletid: lcPal,
            //   }, order: {
            //     fpalletid: 'ASC',
            //   }
            // });
            if (!PHY_MST || !PHY_MST?.id) {
              [PHY_MST] = await this.manager().query(
                `BEGIN SELECT TOP 1 id, TRIM(fpalletid) fpalletid, TRIM(fcustpalid) fcustpalid, fshipstat, fqty, ftrack, frectype FROM dbo.PHY_MST WHERE fpalletid = '${lcPal}' order by fpalletid ASC ; END`,
              );
            }
            /* PHY_MST = await this.manager().query(
              `BEGIN
                 SELECT * FROM PHY_MST WHERE FPALLETID = '${lcPal}' ORDER BY FPALLETID ASC
              END`,
            ); */
            //             console.log(
            //   '---PHY_MST 1276',
            //   PHY_MST,
            //   PHY_MST.length,
            //   '--lcPal',
            //   lcPal,
            // );
            /* if (PHY_MST.length > 0) {
              const { FTRACK: ftrack, FRECTYPE: frectype } = PHY_MST[0]; */
            if (PHY_MST) {
              const { ftrack, frectype } = PHY_MST;
              if (ftrack.slice(0, 7) !== recvo.lc_batch) {
                errMsg = constant.PALLET_DUPLICATE;
              } else if (frectype.toUpperCase() === 'O') {
                errMsg = constant.PALLET_REC;
              } else if (recvo.dynBat.length > 0) {
                outKey = 'palReScan';
                llPal = true;
              } else {
                llPal = true;
              }
            } else {
              // const p = new PhyMst();
              // p.fpalletid = lcPal;
              // p.fcustcode = LOADIN.fcustcode;
              // p.ftrack = LOADIN.fbatch;
              // p.fpal = 1;
              // p.foPal = 1;
              // p.fdatestamp = date;
              // p.ftimestamp = time;
              // p.frectype = 'X';
              // p.fshipstat = 'N';
              // p.fwho = fwho;
              // p.fscanwho = fwho;
              // p.fscantime = time;
              // p.fscandte = date;
              // p.fstatus = recvo.lc_status;
              const insertPhyMst = `INSERT INTO PHY_MST (fpalletid, fcustcode, ftrack, fpal, FO_PAL, fdatestamp, ftimestamp, frectype, fshipstat, fwho,fscanwho,fscantime,fscandte,fstatus)
                VALUES (
                  '${lcPal}',
                  '${LOADIN.fcustcode}',
                  '${LOADIN.fbatch}',
                  1,
                  1,
                  '${date}',
                  '${time}',
                  'X',
                  'N',
                  '${fwho}',
                  '${fwho}',
                  '${time}',
                  '${date}',
                  '${recvo.lc_status ?? ''}'
                )`;
              await this.manager()
                .query(insertPhyMst)
                .catch(error => {
                  this.logger.error(
                    { fpalletid: lcPal, fbatch: LOADIN.fbatch },
                    'Error in PHY_MST INSERT Query',
                    'RECEIVING > PROCESS_PALLET_ID',
                  );
                  throw error;
                });
              // await this.phymstRepo().save(p);
              llPal = true;
            }
          } else {
            // const p = new PhyMst();
            // p.fpalletid = lcPal;
            // p.fcustcode = LOADIN.fcustcode;
            // p.ftrack = LOADIN.fbatch;
            // p.fpal = 1;
            // p.foPal = 1;
            // p.fdatestamp = date;
            // p.ftimestamp = time;
            // p.frectype = 'X';
            // p.fshipstat = 'N';
            // p.fwho = fwho;
            // p.fscanwho = fwho;
            // p.fscantime = time;
            // p.fscandte = date;
            // p.fstatus = recvo.lc_status;
            const insertPhyMst = `INSERT INTO PHY_MST (fpalletid, fcustcode, ftrack, fpal, FO_PAL, fdatestamp, ftimestamp, frectype, fshipstat, fwho,fscanwho,fscantime,fscandte,fstatus)
              VALUES (
                '${lcPal}',
                '${LOADIN.fcustcode}',
                '${LOADIN.fbatch}',
                1,
                1,
                '${date}',
                '${time}',
                'X',
                'N',
                '${fwho}',
                '${fwho}',
                '${time}',
                '${date}',
                '${recvo.lc_status ?? ''}'
              )`;
            await this.manager()
              .query(insertPhyMst)
              .catch(error => {
                this.logger.error(
                  { fpalletid: lcPal, fbatch: LOADIN.fbatch },
                  'Error in PHY_MST INSERT Query',
                  'RECEIVING > PROCESS_PALLET_ID',
                );
                throw error;
              });
            // await this.phymstRepo().save(p);
            llPal = true;
          }
          if (llPal) {
            if (outKey === 'palReScan') {
              recvo.curOper = ReceivingState.MARK_PROCESS_PALLET_RESCAN;
            } else if (
              recvo.lc_hascust === 'Y' &&
              recvo.ll_rffnd &&
              recvo.RFREQ
            ) {
              if (recvo.RFREQ.fcpal === 'Y') {
                recvo.lc_custpal = recvo.lc_pal;
                recvo.curOper = ReceivingState.MARK_PROCESS_PROD;
                outKey = 'product';
              } else {
                recvo.curOper = ReceivingState.MARK_PROCESS_CUST_PALLET;
                const c = getFields(ReceivingState.MARK_PROCESS_CUST_PALLET);
                if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
                  c.maxFieldLen = recvo.RFREQ.fscanlngth;
                scrnUI.push(c);
                outKey = 'custPalletID';
              }
            } else {
              recvo.curOper = ReceivingState.MARK_PROCESS_PROD;
              outKey = 'product';
            }
            if (outKey === 'product') {
              const p = getFields(ReceivingState.MARK_PROCESS_PROD);
              p.badAllowEmptyMsg = recvo.llUse128Barcode
                ? constant.BAD_SCAN
                : constant.PRODUCT_BLANK;
              if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
                p.maxFieldLen = recvo.RFREQ.fscanlngth;
              if (recvo.ll_ASNpal) {
                recvo = await this.applyASN(recvo);
                p.defaultVal = recvo.lc_prod;
                p.value = recvo.lc_prod;
              }
              scrnUI.push(p);
              if (
                recvo.lc_hascust === 'Y' &&
                recvo.ll_rffnd &&
                recvo.RFREQ &&
                recvo.RFREQ.fcpal === 'Y'
              ) {
                const c = getFields(ReceivingState.MARK_PROCESS_CUST_PALLET);
                // add recvo.llUse128Barcode flag to the if condition if cust pallet value is to be altered only when pallet is scanned.
                if ((RFREQ.fcpalfrom > 1 || RFREQ.fcpalto > 0)) {
                  const lnStartFrom = RFREQ.fcpalfrom < 2 ? 1 : RFREQ.fcpalfrom;
                  // c.defaultVal = recvo.lc_custpal
                  c.defaultVal = recvo.lc_custpal.slice(lnStartFrom - 1, RFREQ.fcpalto);
                }
                // if customer want XX right characters. --> need to check this flow
                else if (RFREQ.CustomerPIDLength > 0)
                  c.defaultVal = recvo.lc_custpal.trim().slice(-RFREQ.CustomerPIDLength);
                else
                  c.defaultVal = recvo.lc_custpal
                // update the custpal
                recvo.lc_custpal = c.defaultVal
                c.value = c.defaultVal;
                c.readable = true;
                scrnUI.push(c);
              }
            }
            await this.cacheService.setcache(fwho, RECEIVING, recvo);
            errMsg = '';
          }
        }
      } else {
        errMsg = constant.PALLET_BLANK;
      }
    } else {
      errMsg = constant.PALLET_BLANK;
    }
    if (
      recVO.plUsedF8 &&
      recvo.curOper === ReceivingState.MARK_PROCESS_CUST_PALLET
    ) {
      // Pushing MARK_PROCESS_CUST_PALLET
      const c = getFields(ReceivingState.MARK_PROCESS_CUST_PALLET);
      c.defaultVal = recvo.lc_custpal;
      c.value = recvo.lc_custpal;
      scrnUI.push(c);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg,
        infoMsg: '',
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processRescanPal(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    let recvo = recVO;
    const scrnUI = [];
    const lcSamePal = body.palReScan;
    if (lcSamePal && lcSamePal.toUpperCase() === 'Y') {
      await this.manager()
        .query(
          `BEGIN UPDATE PHY_MST set FMERGEID = '' where FMERGEID = 'MP' and FPALLETID =  '${recvo.lc_pal}'; END`,
        )
        .catch(error => {
          this.logger.error(
            { fpalletid: recvo.lc_pal },
            'Error in PHY_MST UPDATE Query',
            'RECEIVING > PROCESS_RESCANPALLET_ID',
          );
          throw error;
        });
      if (recvo.lc_hascust === 'Y' && recvo.ll_rffnd && recvo.RFREQ) {
        if (recvo.RFREQ.fcpal === 'Y') {
          recvo.lc_custpal = recvo.lc_pal;
          recvo.curOper = ReceivingState.MARK_PROCESS_PROD;
        }
        recvo.curOper = ReceivingState.MARK_PROCESS_CUST_PALLET;
        const c = getFields(ReceivingState.MARK_PROCESS_CUST_PALLET);
        if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
          c.maxFieldLen = recvo.RFREQ.fscanlngth;
        scrnUI.push(c);
      } else {
        recvo.curOper = ReceivingState.MARK_PROCESS_PROD;
      }
      if (recvo.curOper === ReceivingState.MARK_PROCESS_PROD) {
        const p = getFields(ReceivingState.MARK_PROCESS_PROD);
        p.badAllowEmptyMsg = recvo.llUse128Barcode
          ? constant.BAD_SCAN
          : constant.PRODUCT_BLANK;
        if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
          p.maxFieldLen = recvo.RFREQ.fscanlngth;
        if (recvo.ll_ASNpal) {
          recvo = await this.applyASN(recvo);
          p.defaultVal = recvo.lc_prod;
          p.value = recvo.lc_prod;
        }
        scrnUI.push(p);
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else {
      errMsg = constant.PALLET_NOT;
      recvo.curOper = ReceivingState.MARK_PROCESS_PALLET;
      const d = getFields(ReceivingState.MARK_PROCESS_PALLET);
      if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
        d.maxFieldLen = recvo.RFREQ.fscanlngth;
      scrnUI.push(d);
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg,
        infoMsg: '',
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      recvo.curOper === ReceivingState.MARK_PROCESS_PALLET
        && recvo.lineageFreightManagement && ['L', 'D', 'S'].includes(recvo.quickRec?.fquickrcv?.trim())
        ? `${constant.F5_EXIT}`
        : `${constant.F5_EXIT}~${constant.F8_LABL}`,
    );
  }

  async processCustPal(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    let recvo = recVO;
    let lcCustpal = '';
    const scrnUI = [];
    if (body.custPal && body.custPal.trim().length > 0) {
      lcCustpal = body.custPal.trim().toUpperCase();
      recvo.lc_custpal =
        lcCustpal && lcCustpal?.length > 0 && recvo.ln_CustomerPIDLength > 0
          ? lcCustpal.slice(recvo.ln_CustomerPIDLength * -1)
          : lcCustpal;
      const p = getFields(ReceivingState.MARK_PROCESS_PROD);
      if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
        p.maxFieldLen = recvo.RFREQ.fscanlngth;
      p.badAllowEmptyMsg = recvo.llUse128Barcode
        ? constant.BAD_SCAN
        : constant.PRODUCT_BLANK;
      if (recvo.ll_ASNpal) {
        recvo = await this.applyASN(recvo);
        p.defaultVal = recvo.lc_prod;
        p.value = recvo.lc_prod;
      }
      scrnUI.push(p);
      if (recvo.ln_CustomerPIDLength > 0) {
        const c = getFields(ReceivingState.MARK_PROCESS_CUST_PALLET);
        c.defaultVal = recvo.lc_custpal;
        c.value = recvo.lc_custpal;
        scrnUI.push(c);
      }
      recvo.curOper = ReceivingState.MARK_PROCESS_PROD;
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else {
      errMsg = constant.CUSTPAL_BLANK;
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg,
        infoMsg: '',
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async applyASN(recVO: ReceivingVO): Promise<ReceivingVO> {
    const recvo = recVO;
    let lcProd = '';
    // APPLY ASN INFORMATION
    if (recvo.ll_ASNpal) {
      // let ediPal = await this.editPAlRepo().findOne({
      //   where: {
      //     fbatch: recvo.lc_batch,
      //     fpalletid: recvo.lc_pal,
      //   },
      //   order: {
      //     fbatch: 'ASC',
      //     fpalletid: 'ASC',
      //   },
      // });
      const [ediPal] = await this.manager().query(`
        SELECT TOP 1 id, fpalletid, fproduct, FORMAT(fcodedte,'yyyy-MM-dd') as fcodedte,fqty, flot, fbatch FROM EDI_PAL where
          fbatch = '${recvo.lc_batch}' AND fpalletid = '${recvo.lc_pal}' ORDER by fbatch,fpalletid;
      `);
      if (ediPal && ediPal.fpalletid.length > 0) {
        lcProd = ediPal.fproduct ? ediPal.fproduct : '';
        if (ediPal.fcodedte) {
          recvo.lc_dte = moment(ediPal.fcodedte, 'YYYY-MM-DD').format(
            'MMDDYYYY',
          );
          recvo.lc_jdte = this.RFDTOJ(recvo.lc_dte);
        }
        recvo.lc_lot =
          recvo.lc_keylot === 'Y' &&
          ediPal.flot &&
          ediPal.flot.trim().length > 0
            ? ediPal.flot
            : '';
        recvo.lc_qty = ediPal.fqty
          .toString()
          .trim()
          .padStart(4, '0');
        recvo.pnExpectedAsnQty = ediPal.fqty;
        recvo.lc_prod = lcProd;
      } else if (recvo.lc_hascust === 'Y') {
        // ediPal = await this.editPAlRepo().findOne({
        //   fbatch: recvo.lc_batch,
        //   fpalletid: recvo.lc_custpal,
        // });
        const [ediPal] = await this.manager().query(`
          SELECT TOP 1 id, fpalletid, fproduct, FORMAT(fcodedte,'yyyy-MM-dd') as fcodedte,fqty, flot, fbatch FROM EDI_PAL where
            fbatch = '${recvo.lc_batch}' AND fpalletid = '${recvo.lc_custpal}' ORDER by fbatch,fpalletid;
        `);
        if (ediPal) {
          lcProd = ediPal.fproduct ? ediPal.fproduct : '';
          if (ediPal.fcodedte) {
            recvo.lc_dte = moment(ediPal.fcodedte, 'YYYY-MM-DD').format(
              'MMDDYYYY',
            );
            recvo.lc_jdte = this.RFDTOJ(recvo.lc_dte);
          }
          recvo.lc_lot =
            recvo.lc_keylot === 'Y' &&
            ediPal.flot &&
            ediPal.flot.trim().length > 0
              ? ediPal.flot
              : '';
          recvo.lc_qty = ediPal.fqty
            .toString()
            .trim()
            .padStart(4, '0');
          recvo.pnExpectedAsnQty = ediPal.fqty;
          recvo.lc_prod = lcProd;
        }
      }
    }
    this.logger.debug(
      'receiving -->',
      `ASN --> ${recvo.lc_dte}, ${recvo.lc_lot}, ${recvo.lc_qty}`,
    );
    return recvo;
  }

  async processProduct(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
    footer: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    /**
     * Added code to replace multiple rfreq version with actual valid rfreq
     */
    if (body?.rfreq) {
      const RFREQ = body.rfreq;
      recvo.lc_keylot = RFREQ.fkeylot === 'Y' ? 'Y' : 'N';
      recvo.lc_keyestb = RFREQ.fltestbnum === 'Y' ? 'Y' : 'N';
      recvo.lc_keyref = RFREQ.fkeyref === 'Y' ? 'Y' : 'N';
      recvo.lc_keytmp = RFREQ.fkeytemp === 'Y' ? 'Y' : 'N';
      recvo.llUse128Barcode = RFREQ.fuse128Bar;
      recvo.lnBarcodeScanLength = RFREQ.fscanlngth;
      recvo.ll_yywwdcool = RFREQ.fyywwdcool ? RFREQ.fyywwdcool : false;
      recvo.ll_ASNpal = RFREQ.fedipal ? RFREQ.fedipal : false;
      recvo.ll_ASNpalNoQty = RFREQ.edipalnoqty ? RFREQ.edipalnoqty : false;
      recvo.plCalcPRBBDate = RFREQ.calcProdOrBBDate;
      recvo.ln_CustomerPIDLength = RFREQ.CustomerPIDLength;
      recvo.plAutoFillConsignee = RFREQ.AutoFillConsignee;
      recvo.RFREQ = RFREQ;
    }
    let errMsg = '';
    let lcProd = '';
    let data = { CODE2: new Code2(), footer: undefined };
    let outkey = 'product';
    const scrnUI = [];
    const scanFields: string[] = [];
    if (body.scanFields && body.scanFields?.length > 0) {
      scanFields.push(...body.scanFields);
    }

    recvo.lc_ReqBlastKey = '';

    if (body.prod && body.prod.trim().length > 0) {
      lcProd = body.prod.trim().toUpperCase();
      const lcTempProd = lcProd;
      const CONFIG = (recvo.CONFIG as unknown) as Config;
      const gcActiv = CONFIG?.factiv === true;
      if (gcActiv && recvo.lc_oldprod.length > 0 && lcProd === '6') {
        return this.USEDF6COPY(fwho, recvo, constant);
      }

      if (Number(lcProd) > 0 && lcTempProd.length > 0) {
        lcProd = lcTempProd;
      }

      if (lcProd.length > 0) {
        const LOADIN = (recvo.LOADIN as unknown) as Loadin;
        const upperLcProd = lcProd.toUpperCase();

        const Code2result = await this.manager()
          .createQueryBuilder(Code2, 'cd')
          .leftJoin('Custset', 'cs', 'cs.fcustcode = cast(:custCode as char(10))', { custCode: recvo.LOADIN.fcustcode })
          .leftJoin('GTIN', 'g', 'cd.fcustcode = g.fcustcode AND cd.fprodgroup = g.fprodgroup AND cd.fproduct = g.fproduct AND cd.fowner = g.fowner AND cd.fsuplrprod = g.fsuplrprod')
          .where('cd.fcustcode = cast(:fcustcode as char(10))', { fcustcode: recvo.LOADIN.fcustcode })
          .andWhere('cd.fowner = cast(:fowner as char(10))', { fowner: recvo.LOADIN.fowner.trim().length > 0 ? recvo.LOADIN.fowner : recvo.LOADIN.fcustcode })
          .andWhere(new Brackets(qb => {
            qb.where('UPPER(cd.fproduct) = cast(:product as char(16))', { product: upperLcProd })
              .orWhere('UPPER(cd.fsuplrprod) = cast(:suplrprod as char(16))', { suplrprod: upperLcProd })
              .orWhere(new Brackets(qb2 => {
                qb2.where('cs.GTINProductValidation = :gtinValidation', { gtinValidation: 1 })
                  .andWhere(new Brackets(qb3 => {
                    qb3.where('UPPER(g.fcasegtin) = cast(:casegtin as char(14))', { casegtin: upperLcProd })
                      .orWhere('UPPER(g.fpalgtin) = cast(:palgtin as char(14))', { palgtin: upperLcProd })
                      .orWhere('UPPER(g.fgln) = cast(:gln as char(13))', { gln: upperLcProd })
                      .orWhere('UPPER(g.fcustdata) = cast(:custdata as char(20))', { custdata: upperLcProd });
                  }));
              }));
          }))
          .andWhere('cd.active = cast(:active as char(1))', { active: 'Y' })
          .orderBy('cd.id')
          .limit(1)
          .getOne();

        const CODE2: Code2 = Code2result as Code2;
        let result: boolean = false;

        if (Code2result) {
          result = true;
          lcProd = Code2result.fproduct;
        }

        if (result) {
          recvo.CODE2 = CODE2;
          data = { CODE2, footer: undefined };
          const RFEXPINVres = await this.manager()
            .createQueryBuilder(Rfexpinv, 'rf')
            .where('rf.FBATCH = cast(:batch as char(7))', { batch: recvo.lc_batch })
            .andWhere('rf.FPRODGROUP = cast(:prodGroup as char(5))', { prodGroup: CODE2.fprodgroup })
            .andWhere('rf.FPRODUCT = cast(:product as char(16))', { product: CODE2.fproduct })
            .andWhere('rf.FOWNER = cast(:owner as char(10))', { owner: CODE2.fowner })
            .andWhere('rf.FSUPLRPROD = cast(:suplrProd as char(16))', { suplrProd: CODE2.fsuplrprod })
            .orderBy('rf.FBATCH')
            .addOrderBy('rf.FPRODGROUP')
            .addOrderBy('rf.FPRODUCT')
            .addOrderBy('rf.FOWNER')
            .addOrderBy('rf.FSUPLRPROD')
            .addOrderBy('rf.FLOT')
            .limit(1)
            .getRawOne();

          const RFEXPINV: Rfexpinv = RFEXPINVres;
          if (recvo.llQuickrcv && !recvo.ll_intrucktotruck && !RFEXPINV) {
            errMsg = constant.QUICK_RCV;
          } else {
            recvo.ll_iscatch =
              CODE2.fcatchwgt === 'I' || CODE2.fcatchwgt === 'B'; //  see if needs catchweight
            recvo.ll_oldcatch = recvo.ll_iscatch;
            recvo.lc_acwt = CODE2.fnetwgt;
            recvo.lc_oldacwt = recvo.lc_acwt;
            recvo.lc_dtetyp =
              CODE2.fdatetype && CODE2.fdatetype === '1'
                ? 'J'
                : CODE2.fdatetype === '2'
                ? 'C'
                : 'N';
            recvo.lc_olddtetyp = recvo.lc_dtetyp;
            recvo.ln_blasthrs = CODE2.fblasthrs === 0 ? 72 : CODE2.fblasthrs;
            recvo.pnWidth = CODE2.fwidth;
            recvo.pnHeight = CODE2.fheight;
            recvo.pnLength = CODE2.flength;
            recvo.ln_intie = CODE2.ftie;
            recvo.ln_oldtie = recvo.ln_intie;
            recvo.ln_high = CODE2.fhigh;
            recvo.ln_oldhigh = recvo.ln_high;
            recvo.lc_oldprod = lcProd;
            recvo.lc_isblast = CODE2?.fblastroom?.trim().length > 0 ? 'Y' : 'N';
            recvo.lc_isblast1 =
              CODE2?.fblastroom?.trim().length > 0 ? 'Y' : 'N';
            recvo.lc_isHPP = CODE2?.fishpp === true ? 'Y' : 'N';
            recvo.ll_isHPPin = CODE2?.fishpp === true;
            recvo.lc_bbdtetype = CODE2.fbbdtetype ? CODE2.fbbdtetype : '';
            await this.getLotPatternConfig(recvo, CODE2);
            recvo.lc_EdiReqBlastBatchProduct = `${LOADIN.fbatch.toString()}${
              CODE2.fproduct ? CODE2.fproduct : ''
            }`;
            recvo.lc_ReqBlastKey = `${LOADIN.fbatch.toString()}${(CODE2.fprodgroup
              ? CODE2.fprodgroup.padEnd(4, ' ')
              : ''
            ).padEnd(4, ' ')}${CODE2.fproduct ? CODE2.fproduct : ''}`;
          }

          if (recvo.plDynamicRail && recvo.pcCurProd !== lcProd) {
            const query = await this.facilityService
              .getConnection()
              .createEntityManager()
              .query(
                `Select bl_exists = CAST(Case When Exists (Select 1 From DYNAMICRAIL Where FBATCH = '${recvo.dynBat}' and FPRODUCT ='${lcProd}') Then 1 else 0 End as bit);`,
              );
            if (query && query[0] && !query[0]?.bl_exists) {
              recvo.lc_prod = lcProd;
              recvo.curOper = ReceivingState.MARK_PROCESS_BOL_QTY;
              await this.cacheService.setcache(fwho, RECEIVING, recvo);
              return new ResponseKeysDTO(
                plainToClass(PostResponseReceivingDTO, {
                  errMsg,
                  curOper: recvo.curOper,
                  data,
                }),
                getOutFieldState(recvo.curOper),
                '',
                '',
                `${constant.F5_EXIT}`,
              );
            }
          }
        } else {
          errMsg = constant.PRODUCT_NO_ACTIVE;
        }
      } else {
        lcProd = '';
        errMsg = recvo.llUse128Barcode
          ? constant.BAD_SCAN
          : constant.PRODUCT_BLANK;
      }

      if (errMsg.length === 0) {
        recvo.lc_prod = lcProd;
        errMsg = '';
        if (recvo.lc_dtetyp === 'N') {
          recvo.lc_dte = recvo.LOADIN.fbdate === null
            ? this.facilityService.getFacilityCurrentDateTimeFormatted('MMDDYYYY')
            : moment(recvo.LOADIN.fbdate, 'YYYY-MM-DD').format('MMDDYYYY');
          recvo.curOper = ReceivingState.MARK_PROCESS_QTY;
          const q = getFields(ReceivingState.MARK_PROCESS_QTY);
          q.badOneOfValidMsg = `${constant.QTY_TIE} ${recvo.ln_intie} X ${recvo.ln_high} ${constant.OK_QUES}`;
          q.justDisplay = `${recvo.ln_intie * recvo.ln_high}`;
          if (recvo.ll_ASNpal && recvo.ll_ASNpalNoQty === false) {
            let tempqty = Number(recvo.lc_qty).toString();
            tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
            q.defaultVal = tempqty;
            q.value = tempqty;
          } else {
            q.defaultVal = '';
            q.value = '';
          }
          scrnUI.push(q);
          const cd = getFields(ReceivingState.SHOW_PROCESS_CDATE);
          cd.defaultVal = recvo.lc_dte;
          cd.value = recvo.lc_dte;
          scrnUI.push(cd);
          outkey = 'qty';
        } else if (recvo.pl_AutoDateForProdLot && recvo.lc_keylot === 'Y') {
          recvo.curOper = ReceivingState.MARK_PROCESS_QTY;
          outkey = 'qty';
          const d = getFields(
            recvo.lc_dtetyp === 'J'
              ? ReceivingState.SHOW_PROCESS_JDATE
              : ReceivingState.SHOW_PROCESS_CDATE,
          );
          d.readable = true;
          d.editable = false;
          scrnUI.push(d);
          const q = getFields(ReceivingState.MARK_PROCESS_QTY);
          scrnUI.push(q);
        } else {
          recvo.curOper = ReceivingState.MARK_PROCESS_DATE;
          if (scanFields.includes('prod') && scanFields.includes('cdate')) {
            await this.cacheService.setcache(fwho, RECEIVING, recvo);
            return this.SCANDATE(
              fwho,
              body,
              recvo,
              constant,
              scanFields,
              footer,
            );
          }
          outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
          const d = getFields(
            recvo.lc_dtetyp === 'J'
              ? ReceivingState.SHOW_PROCESS_JDATE
              : ReceivingState.SHOW_PROCESS_CDATE,
          );
          if (recvo.ll_ASNpal) {
            d.defaultVal =
              recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
            d.value = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
          }
          scrnUI.push(d);
          if (
            recvo.plCalcPRBBDate &&
            (recvo.lc_bbdtetype === '1' || recvo.lc_bbdtetype === '2')
          ) {
            const bdt = getFields(
              recvo.lc_bbdtetype === '1'
                ? ReceivingState.MARK_PROCESS_BB_JDATE
                : ReceivingState.MARK_PROCESS_BB_DATE,
            );
            bdt.readable = true;
            bdt.editable = false;
            bdt.avoidable = false;
            scrnUI.push(bdt);
            data = { CODE2: recvo.CODE2, footer };
          }
        }
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
      }
    } else {
      errMsg = recvo.llUse128Barcode
        ? constant.BAD_SCAN
        : constant.PRODUCT_BLANK;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        data,
        scrnUI,
      }),
      getOutputFields(outkey),
      '',
      '',
      data?.footer
        ? `${constant.F2_SKIP}~${constant.F5_EXIT}`
        : `${constant.F5_EXIT}`,
    );
  }

  async processDWRailBolQty(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const recvo = recVO;
    let errMsg = '';
    const scrnUI = [];
    if (body.bolQty) {
      if (body.bolQty >= 0) {
        recvo.bolQty = body.bolQty;
        recvo.curOper = ReceivingState.MARK_PROCESS_TIE_YN;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const t = getFields(ReceivingState.MARK_PROCESS_TIE_YN);
        const CODE2 = (recvo.CODE2 as unknown) as Code2;
        t.label = `${constant.TIE_HIGH} ${CODE2.ftie} X ${CODE2.fhigh} ${constant.CONTINUEYN}`;
        t.justDisplay = `${CODE2.ftie} X ${CODE2.fhigh}`;
        scrnUI.push(t);
        const q = getFields(ReceivingState.MARK_PROCESS_BOL_QTY);
        q.avoidable = true;
        scrnUI.push(q);
      } else {
        errMsg = constant.QTY_NON_0;
      }
    } else {
      errMsg = constant.QTY_EMPTY;
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        curOper: recvo.curOper,
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processDWRailTie(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const recvo = recVO;
    let errMsg = '';
    const scrnUI = [];

    if (body.tie) {
      if (body.tie > 0) {
        recvo.ln_intie = body.tie;
        recvo.curOper = ReceivingState.MARK_PROCESS_HIGH;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const t = getFields(ReceivingState.MARK_PROCESS_HIGH);
        scrnUI.push(t);
        const q = getFields(ReceivingState.MARK_PROCESS_TIE);
        q.avoidable = true;
        scrnUI.push(q);
      } else {
        errMsg = constant.NON_0;
      }
    } else {
      errMsg = constant.EMPTY;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        curOper: recvo.curOper,
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processDWRailHigh(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const recvo = recVO;
    let errMsg = '';
    const scrnUI = [];

    if (body.high) {
      if (body.high > 0) {
        recvo.ln_high = body.high;
        recvo.curOper = ReceivingState.MARK_PROCESS_TIE_YN;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const t = getFields(ReceivingState.MARK_PROCESS_TIE_YN);
        scrnUI.push(t);
        const q = getFields(ReceivingState.MARK_PROCESS_HIGH);
        q.avoidable = true;
        scrnUI.push(q);
      } else {
        errMsg = constant.NON_0;
      }
    } else {
      errMsg = constant.EMPTY;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        curOper: recvo.curOper,
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processDWRailTieYN(
    fwho: string,
    body: PostRequestReceivingDTO,
    recVO: ReceivingVO,
    constant: any,
    footer: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const recvo = recVO;
    let errMsg = '';
    const scrnUI = [];
    let data = {};
    let outkey = 'tieYN';

    if (body.tieYN?.trim()?.toUpperCase() === 'Y') {
      const CODE2 = (recvo.CODE2 as unknown) as Code2;
      await this.storedProceduresNewService.getInsertdynamicrail({
        inFbatch: recvo.lc_batch,
        inFcustcode: CODE2.fcustcode,
        inFhigh: recvo.ln_high > 0 ? recvo.ln_high : CODE2.fhigh,
        inFowner: CODE2.fowner,
        inFprodgroup: CODE2.fprodgroup,
        inFproduct: CODE2.fproduct,
        inFqty: recvo.bolQty,
        inFsuplrprod: CODE2.fsuplrprod,
        inFtie: recvo.ln_intie > 0 ? recvo.ln_intie : CODE2.ftie,
        inFwho: fwho,
      });

      if (recvo.lc_dtetyp === 'N') {
        recvo.lc_dte = recvo.LOADIN.fbdate === null
          ? this.facilityService.getFacilityCurrentDateTimeFormatted('MMDDYYYY')
          : moment(recvo.LOADIN.fbdate, 'YYYY-MM-DD').format('MMDDYYYY');
        recvo.curOper = ReceivingState.MARK_PROCESS_QTY;
        const q = getFields(ReceivingState.MARK_PROCESS_QTY);
        q.badOneOfValidMsg = `${constant.QTY_TIE} ${recvo.ln_intie} X ${recvo.ln_high} ${constant.OK_QUES}`;
        q.justDisplay = `${recvo.ln_intie * recvo.ln_high}`;
        if (recvo.ll_ASNpal && recvo.ll_ASNpalNoQty === false) {
          let tempqty = Number(recvo.lc_qty).toString();
          tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
          q.defaultVal = tempqty;
          q.value = tempqty;
        } else {
          q.defaultVal = '';
          q.value = '';
        }
        scrnUI.push(q);
        const cd = getFields(ReceivingState.SHOW_PROCESS_CDATE);
        cd.defaultVal = recvo.lc_dte;
        cd.value = recvo.lc_dte;
        scrnUI.push(cd);
        outkey = 'qty';
        errMsg = '';
      } else {
        recvo.curOper = ReceivingState.MARK_PROCESS_DATE;
        outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
        const d = getFields(
          recvo.lc_dtetyp === 'J'
            ? ReceivingState.SHOW_PROCESS_JDATE
            : ReceivingState.SHOW_PROCESS_CDATE,
        );
        if (recvo.ll_ASNpal) {
          d.defaultVal = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
          d.value = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
        }
        scrnUI.push(d);
        if (
          recvo.plCalcPRBBDate &&
          (recvo.lc_bbdtetype === '1' || recvo.lc_bbdtetype === '2')
        ) {
          const bdt = getFields(
            recvo.lc_bbdtetype === '1'
              ? ReceivingState.MARK_PROCESS_BB_JDATE
              : ReceivingState.MARK_PROCESS_BB_DATE,
          );
          bdt.readable = true;
          bdt.editable = false;
          bdt.avoidable = false;
          scrnUI.push(bdt);
          data = { CODE2: recvo.CODE2, footer };
        }
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
      const t = getFields(ReceivingState.MARK_PROCESS_TIE_YN);
      t.avoidable = true;
      scrnUI.push(t);
      errMsg = '';
    } else if (body.tieYN?.trim()?.toUpperCase() === 'N') {
      errMsg = '';
      recvo.curOper = ReceivingState.MARK_PROCESS_TIE;
      outkey = 'tie';
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else {
      errMsg = constant.BLAST_MUST_YN;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutputFields(outkey),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processQty(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    let lcQty = 0;
    let llQty = 0;
    let outkey = 'qty';
    let scrnUI = [];
    let footerData = `${constant.F5_EXIT}`;
    if (recvo.curOper === ReceivingState.MARK_PROCESS_QTY_YN) {
      if (body.qtyYN?.toString().toUpperCase() === 'Y') {
        llQty = 2;
        lcQty = recvo.lc_qty !== '' ? Number(recvo.lc_qty) : 0;
      } else {
        recvo.curOper = ReceivingState.MARK_PROCESS_QTY;
        llQty = 0;
        lcQty = 0;
        recvo.lc_qty = '';
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const qyn = getFields(ReceivingState.MARK_PROCESS_QTY_YN);
        qyn.avoidable = true;
        scrnUI.push(qyn);
        const q = getFields(ReceivingState.MARK_PROCESS_QTY);
        q.badOneOfValidMsg = `${constant.QTY_TIE} ${recvo.ln_intie} X ${recvo.ln_high} ${constant.OK_QUES}`;
        q.justDisplay = `${recvo.ln_intie * recvo.ln_high}`;
        if (recvo.ll_ASNpal && recvo.ll_ASNpalNoQty === false) {
          let tempqty = Number(recvo.lc_qty).toString();
          tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
          q.defaultVal = tempqty;
          q.value = tempqty;
        } else {
          q.defaultVal = '';
          q.value = '';
        }
        scrnUI.push(q);
        return new ResponseKeysDTO(
          plainToClass(PostResponseReceivingDTO, {
            errMsg,
            infoMsg: '',
            curOper: recvo.curOper,
            scrnUI,
          }),
          getOutFieldState(recvo.curOper),
          '',
          '',
          `${constant.F5_EXIT}`,
        );
      }
    } else if (body.qty.toString() !== '') {
      if (body.qty >= 0) {
        lcQty = body.qty;
        if (recvo.llQuickrcv && lcQty === 0) {
          const [STAGE] = await this.manager().query(
            `SELECT TOP 1 id, fcubedid, floaddate from STAGE WHERE fcubedid = '${recvo.lc_pal}' ORDER BY fcubedid`,
          );
          if (STAGE && STAGE?.floaddate !== undefined) {
            errMsg = constant.PALLETS_LOADED;
            lcQty = 0;
          } else {
            llQty = 2;
          }
        } else {
          llQty = 2;
        }

        if (
          recvo.pnExpectedAsnQty > 0 &&
          recvo.pnExpectedAsnQty !== Number(lcQty)
        ) {
          recvo.plUnmatchedAsnQty = true;
        }
      } else {
        errMsg = constant.QTY_NON_0;
      }
    } else {
      errMsg = constant.QTY_EMPTY;
    }

    if (
      recvo.curOper === ReceivingState.MARK_PROCESS_QTY &&
      lcQty !== recvo.ln_intie * recvo.ln_high &&
      errMsg !== constant.PALLETS_LOADED
    ) {
      recvo.curOper = ReceivingState.MARK_PROCESS_QTY_YN;
      const q = getFields(ReceivingState.MARK_PROCESS_QTY_YN);
      q.label = `${constant.QTY_TIE} ${recvo.ln_intie} X ${recvo.ln_high} ${constant.OK_QUES}`;
      q.avoidable = false;
      scrnUI.push(q);
      recvo.lc_qty = lcQty.toString();
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
      return new ResponseKeysDTO(
        plainToClass(PostResponseReceivingDTO, {
          errMsg,
          infoMsg: '',
          curOper: recvo.curOper,
          scrnUI,
        }),
        getOutFieldState(recvo.curOper),
        '',
        '',
        `${constant.F5_EXIT}`,
      );
    }

    let data;
    if (llQty > 0) {
      recvo.lc_qty = lcQty.toString();
      if (!recvo.ll_usedF6) {
        let lcIsblast;
        if (recvo.lc_hasblast === 'Y') {
          const blastQueries = ` DECLARE @fcustcode char(10), @fstatus char(6), @ediLogFstatus char(6), @fbatch char(7), @fprodgroup char(7), @fproduct char(16), @blastStatusId int, @ediLogId int, @reqBlastId int;
            SELECT TOP 1 @blastStatusId = id, @fcustcode = fcustcode, @fstatus = fstatus FROM BLSTSTATUS where fcustcode = '${recvo.LOADIN.fcustcode}' order by fcustcode, fstatus;
            SELECT TOP 1 @ediLogId = id, @ediLogFstatus = fstatus FROM EDI_LOG WHERE fbatch+fproduct = '${recvo.lc_EdiReqBlastBatchProduct}';
            SELECT TOP 1 @reqBlastId = id, @fbatch = fbatch, @fprodgroup = fprodgroup, @fproduct = fproduct FROM REQBLAST where fbatch+fproduct = '${recvo.lc_ReqBlastKey}';
            SELECT @blastStatusId blastStatusId, @ediLogId ediLogId, @reqBlastId reqBlastId, @fcustcode fcustcode, @fstatus fstatus, @ediLogFstatus ediLogFstatus, @fproduct fproduct, @fbatch fbatch, @fprodgroup fprodgroup;
          `;
          const [blastQueryResult] = await this.manager()
            .query(blastQueries)
            .catch(error => {
              this.logger.error(
                {
                  fcustcode: recvo.LOADIN?.fcustcode,
                  edifbatchFproduct: recvo.lc_EdiReqBlastBatchProduct,
                  reqFbatchFprod: recvo.lc_ReqBlastKey,
                },
                'Error in BLSTSTATUS/EDI_LOG/REQBLAST FETCH Query',
                'RECEIVING > PROCESS_QTY',
              );
              throw error;
            });
          let BLSTSTATUS;
          let EDI_LOG;
          let REQBLAST: any;
          if (blastQueryResult) {
            if (blastQueryResult.blastStatusId) {
              BLSTSTATUS = {
                fcustcode: blastQueryResult?.fcustcode,
                fstatus: blastQueryResult?.fstatus,
              };
            }
            if (blastQueryResult.ediLogId) {
              EDI_LOG = { fstatus: blastQueryResult?.ediLogFstatus };
            }
            if (blastQueryResult.reqBlastId) {
              REQBLAST = {
                fbatch: blastQueryResult?.fbatch,
                fprodgroup: blastQueryResult?.fprodgroup,
                fproduct: blastQueryResult?.fproduct,
              };
            }
          }

          let lcIsblast1 = recvo.lc_isblast1;
          if (
            recvo.lc_EdiControlReqBlast &&
            recvo.lc_EdiControlReqBlast.toUpperCase() === 'P' &&
            EDI_LOG
          ) {
            if (
              BLSTSTATUS &&
              `${recvo.LOADIN.fcustcode}${EDI_LOG.fstatus}` ===
                `${BLSTSTATUS.fcustcode}${BLSTSTATUS.fstatus}`
            ) {
              lcIsblast1 = 'Y';
            }
          } else if (
            REQBLAST &&
            recvo.lc_EdiControlReqBlast.toUpperCase() !== 'P' &&
            recvo.lc_ReqBlastKey ===
              `${REQBLAST.fbatch}${REQBLAST.fprodgroup}${REQBLAST.fproduct}`
          ) {
            lcIsblast1 = 'N';
          }
          if (
            lcIsblast1 &&
            ['Y', 'N'].includes(lcIsblast1.trim().toUpperCase())
          ) {
            lcIsblast = lcIsblast1;
          }
        } else {
          lcIsblast = 'N';
        }
        if (lcIsblast && ['Y', 'N'].includes(lcIsblast)) {
          recvo.lc_isblast = lcIsblast;
        }
      }

      if (!recvo.ll_usedF6 && recvo.lc_hasblast === 'Y') {
        recvo.curOper = ReceivingState.MARK_PROCESS_BLAST;
        outkey = 'blast';
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const b = getFields(ReceivingState.MARK_PROCESS_BLAST);
        b.defaultVal = recvo.lc_isblast1;
        b.value = recvo.lc_isblast1;
        b.readable = false;
        scrnUI.push(b);
        const q = getFields(ReceivingState.MARK_PROCESS_QTY_YN);
        q.avoidable = true;
        scrnUI.push(q);
      } else {
        await this.processHPP(fwho, recvo);
        const q = getFields(ReceivingState.MARK_PROCESS_QTY_YN);
        q.avoidable = true;
        scrnUI.push(q);
        if (!recvo.ll_usedF6 && recvo.ll_isHPPin) {
          const h = getFields(ReceivingState.MARK_PROCESS_HPP);
          h.value = recvo.lc_isHPP;
          scrnUI.push(h);
        } else {
          const b = getFields(ReceivingState.MARK_PROCESS_BLAST);
          b.defaultVal = recvo.lc_isblast1;
          b.value = recvo.lc_isblast1;
          b.avoidable = false;
          scrnUI.push(b);
        }

        recvo.curOper = this.findNextState(recvo);
        if (recvo.curOper === ReceivingState.MARK_PROCESS_CLOT) {
          const clot = getFields(ReceivingState.MARK_PROCESS_CLOT);
          if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
            clot.maxFieldLen = recvo.RFREQ.fscanlngth;
          scrnUI.push(clot);
        }
        if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
          // const o: OSummary = new OSummary();
          // o.labels = this.summary(recvo);
          // if (o.labels.length > 0) {
          //   scrnUI.push(o);
          // }
          scrnUI = [];
          data = { label: getLabelFields('assumeText') };
          footerData = `${constant.F7_DIMS}`;
          scrnUI.push(...this.summary2(recvo));
          //dynamic attribute code added
          const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
          scrnUI.push(...dynamicAttributes); // Push dynamic attribute data
        } else {
          outkey = 'lot';
          if (recvo.lc_keylot === 'Y') {
            const l = getFields(ReceivingState.MARK_PROCESS_LOT);
            if (recvo.ll_ASNpal) {
              l.defaultVal = recvo.lc_lot;
              l.value = recvo.lc_lot;
            }
            if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
              l.maxFieldLen = recvo.RFREQ.fscanlngth;
            scrnUI.unshift(l);
          }
        }
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
      errMsg = '';
    } else if (outkey === 'qty') {
      const q = getFields(ReceivingState.MARK_PROCESS_QTY);
      q.badOneOfValidMsg = `${constant.QTY_TIE} ${recvo.ln_intie} X ${recvo.ln_high} ${constant.OK_QUES}`;
      q.justDisplay = `${recvo.ln_intie * recvo.ln_high}`;
      if (recvo.ll_ASNpal && recvo.ll_ASNpalNoQty === false) {
        let tempqty = Number(recvo.lc_qty).toString();
        tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
        q.defaultVal = tempqty;
        q.value = tempqty;
      } else {
        q.defaultVal = '';
        q.value = '';
      }
      scrnUI.push(q);
    }
    if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
      const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
      q.defaultVal = recvo.curTempVal;
      scrnUI.push(q);
    }

    if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
      scrnUI = [];
      const q = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
      scrnUI.push(q);

      const q1 = getFields(ReceivingState.MARK_PROCESS_QTY_YN);
      q1.avoidable = true;
      scrnUI.push(q1);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  findNextState(recvo: ReceivingVO) {
    const curOper = recvo.curOper.toString();
    let result;
    if (
      (ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
        ReceivingState.MARK_PROCESS_QTY === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper) &&
      recvo.lc_keylot === 'Y'
    ) {
      result = ReceivingState.MARK_PROCESS_LOT;
    } else if (
      ReceivingState.MARK_PROCESS_LOT === curOper &&
      recvo.pl_AutoDateForProdLot &&
      recvo.lc_keylot === 'Y'
    ) {
      result = ReceivingState.MARK_PROCESS_DATE;
    } else if (
      (ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
        ReceivingState.MARK_PROCESS_QTY === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper ||
        ReceivingState.MARK_PROCESS_LOT === curOper) &&
      recvo.lc_haslot === 'Y'
    ) {
      result = ReceivingState.MARK_PROCESS_CLOT;
    } else if (
      (ReceivingState.MARK_PROCESS_QTY === curOper ||
        ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
        ReceivingState.MARK_PROCESS_LOT === curOper ||
        ReceivingState.MARK_PROCESS_CLOT === curOper ||
        ReceivingState.MARK_PROCESS_DATE === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper) &&
      recvo.lc_keyestb === 'Y'
    ) {
      result = ReceivingState.MARK_PROCESS_EST;
    } else if (
      (ReceivingState.MARK_PROCESS_LOT === curOper ||
        ReceivingState.MARK_PROCESS_CLOT === curOper ||
        ReceivingState.MARK_PROCESS_EST === curOper ||
        ReceivingState.MARK_PROCESS_DATE === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper) &&
      recvo.lc_keyestb === 'Y' &&
      !recvo.ll_usedF6
    ) {
      result = ReceivingState.MARK_PROCESS_SDATE;
    } else if (
      (ReceivingState.MARK_PROCESS_LOT === curOper ||
        ReceivingState.MARK_PROCESS_CLOT === curOper ||
        ReceivingState.MARK_PROCESS_SDATE === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper ||
        ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
        ReceivingState.MARK_PROCESS_DATE === curOper ||
        ReceivingState.MARK_PROCESS_QTY === curOper) &&
      recvo.lc_keyref === 'Y' &&
      !recvo.ll_usedF6
    ) {
      result = ReceivingState.MARK_PROCESS_REF;
    } else if (
      (ReceivingState.MARK_PROCESS_LOT === curOper ||
        ReceivingState.MARK_PROCESS_CLOT === curOper ||
        ReceivingState.MARK_PROCESS_REF === curOper ||
        ReceivingState.MARK_PROCESS_EST === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper ||
        ReceivingState.MARK_PROCESS_SDATE === curOper ||
        ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
        ReceivingState.MARK_PROCESS_DATE === curOper ||
        ReceivingState.MARK_PROCESS_QTY === curOper) &&
      recvo.lc_keytmp === 'Y' &&
      !recvo.ll_usedF6
    ) {
      result = ReceivingState.MARK_PROCESS_TEMP;
    } else if (
      (ReceivingState.MARK_PROCESS_LOT === curOper ||
        ReceivingState.MARK_PROCESS_REF === curOper ||
        ReceivingState.MARK_PROCESS_CLOT === curOper ||
        ReceivingState.MARK_PROCESS_TEMP === curOper ||
        ReceivingState.MARK_PROCESS_EST === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper ||
        ReceivingState.MARK_PROCESS_SDATE === curOper ||
        ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
        ReceivingState.MARK_PROCESS_REF === curOper ||
        ReceivingState.MARK_PROCESS_QTY === curOper) &&
      recvo.lc_bbdtetype.trim() !== '' &&
      !recvo.ll_usedF6 &&
      (recvo.lc_bbdte.trim().length === 0 ||
        recvo.lc_BBJULIAN.trim().length === 0)
    ) {
      result =
        recvo.lc_bbdtetype.trim() === '1'
          ? ReceivingState.MARK_PROCESS_BB_JDATE
          : ReceivingState.MARK_PROCESS_BB_DATE;
    } else if (
      (ReceivingState.MARK_PROCESS_LOT === curOper ||
        ReceivingState.MARK_PROCESS_REF === curOper ||
        ReceivingState.MARK_PROCESS_CLOT === curOper ||
        ReceivingState.MARK_PROCESS_TEMP === curOper ||
        ReceivingState.MARK_PROCESS_BB_DATE === curOper ||
        ReceivingState.MARK_PROCESS_BLAST === curOper ||
        ReceivingState.MARK_PROCESS_BB_JDATE === curOper ||
        ReceivingState.MARK_PROCESS_EST === curOper ||
        ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
        ReceivingState.MARK_PROCESS_SDATE === curOper) &&
      recvo.ll_isConsCross
    ) {
      result = ReceivingState.MARK_PROCESS_CONSIGNEE;
    } else if (
      ReceivingState.MARK_PROCESS_QTY_YN === curOper ||
      ReceivingState.MARK_PROCESS_QTY === curOper ||
      ReceivingState.MARK_PROCESS_LOT === curOper ||
      ReceivingState.MARK_PROCESS_CLOT === curOper ||
      ReceivingState.MARK_PROCESS_BLAST === curOper ||
      ReceivingState.MARK_PROCESS_BB_DATE === curOper ||
      ReceivingState.MARK_PROCESS_BB_JDATE === curOper ||
      ReceivingState.MARK_PROCESS_SDATE === curOper ||
      ReceivingState.MARK_PROCESS_EST === curOper ||
      ReceivingState.MARK_PROCESS_REF === curOper ||
      ReceivingState.MARK_PROCESS_TEMP === curOper ||
      ReceivingState.MARK_PROCESS_DATE === curOper ||
      ReceivingState.MARK_PROCESS_CONSIGNEE === curOper
    ) {
      result = ReceivingState.MARK_SEND_PALLET;
    } else {
      result = curOper;
    }
    return result;
  }

  async processBlast(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    let scrnUI = [];
    let data;
    let footerData = `${constant.F5_EXIT}`;
    if (
      body.blast &&
      ['Y', 'N', ''].includes(body.blast.trim().toUpperCase())
    ) {
      let lcIsblast = body.blast.trim().toUpperCase();
      lcIsblast = lcIsblast === '' ? 'N' : lcIsblast;
      const PHYMSTres = await this.manager().query(
        `BEGIN SELECT id, fisblast, fblasthrs FROM dbo.PHY_MST WHERE fpalletid = '${recvo.lc_pal}' order by fpalletid ASC ; END`,
      );
      const PHY_MST: PhyMst = PHYMSTres[0];
      if (PHY_MST) {
        PHY_MST.fisblast = lcIsblast !== 'N';
        PHY_MST.fblasthrs = lcIsblast === 'N' ? 0 : recvo.ln_blasthrs;
        await this.manager()
          .query(
            `BEGIN UPDATE PHY_MST SET fisblast = '${PHY_MST.fisblast}', fblasthrs = '${PHY_MST.fblasthrs}' where id = '${PHY_MST.id}'; END`,
          )
          .catch(error => {
            this.logger.error(
              {
                fisblast: PHY_MST.fisblast,
                fblasthrs: PHY_MST.fblasthrs,
                id: PHY_MST.id,
                fpalletid: recvo.lc_pal,
              },
              'Error in PHY_MST UPDATE Query',
              'RECEIVING > PROCESS_BLAST',
            );
            throw error;
          });
        // await this.phymstRepo().save(PHY_MST);
      }
      recvo.lc_oldisblast = recvo.lc_isblast;
      recvo.lc_isblast = lcIsblast;
      recvo.lc_isblast1 = lcIsblast;

      await this.processHPP(fwho, recvo);
      recvo.curOper = this.findNextState(recvo);
      if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
        const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
        q.defaultVal = recvo.curTempVal;
        scrnUI.push(q);
      }
      if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
        // const o: OSummary = new OSummary();
        // o.labels = this.summary(recvo);
        // if (o.labels.length > 0) {
        //   scrnUI.push(o);
        // }
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS}`;
        scrnUI = [];
        scrnUI.push(...this.summary2(recvo));
        //dynamic attribute code added
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
        scrnUI.push(...dynamicAttributes); // Push dynamic attribute data
      } else {
        if (recvo.curOper === ReceivingState.MARK_PROCESS_LOT) {
          const lot = getFields(ReceivingState.MARK_PROCESS_LOT);
          lot.defaultVal = recvo.lc_lot;
          if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
            lot.maxFieldLen = recvo.RFREQ.fscanlngth;
          scrnUI.push(lot);
        } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CLOT) {
          const clot = getFields(ReceivingState.MARK_PROCESS_CLOT);
          if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
            clot.maxFieldLen = recvo.RFREQ.fscanlngth;
          scrnUI.push(clot);
        } else {
          const o = getFields(recvo.curOper);
          scrnUI.push(o);
        }
        if (!recvo.ll_usedF6 && recvo.ll_isHPPin) {
          const h = getFields(ReceivingState.MARK_PROCESS_HPP);
          h.value = recvo.lc_isHPP;
          scrnUI.push(h);
          const b = getFields(ReceivingState.MARK_PROCESS_BLAST);
          b.defaultVal = recvo.lc_isblast1;
          b.value = recvo.lc_isblast1;
          b.avoidable = true;
          scrnUI.push(b);
        } else {
          const b = getFields(ReceivingState.MARK_PROCESS_BLAST);
          b.defaultVal = recvo.lc_isblast1;
          b.value = recvo.lc_isblast1;
          b.avoidable = false;
          scrnUI.push(b);
        }
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else {
      errMsg = constant.BLAST_MUST_YN;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processHPP(fwho: string, recVO: ReceivingVO): Promise<void> {
    // line 1450 - ** see if HPP
    const recvo = recVO;
    if (!recvo.ll_usedF6 && recvo.ll_isHPPin) {
      const lcIsHPP = 'Y';
      const PHYMSTres = await this.manager().query(
        `BEGIN SELECT id, TRIM(fpalletid) fpalletid, TRIM(fcustpalid) fcustpalid, TRIM(fcustcode) fcustcode, fshipstat, fqty, TRIM(ftrack) ftrack, TRIM(fserial) fserial, TRIM(fhold) fhold, frectype, fishpp FROM dbo.PHY_MST WHERE fpalletid = '${recvo.lc_pal}' order by fpalletid ASC ; END`,
      );
      const PHY_MST: PhyMst = PHYMSTres[0];
      if (PHY_MST) {
        let plUseStackHold = false;
        // let plFoundEDIHPPHold = false;
        let pcEDIHPPValue = 'HPP'; // USE HPP IF NOT FOUND IN CODELKUP
        const rfInbounds = await this.storedProceduresNewService.getRfInboundscheckhpp(
          {
            customercode: PHY_MST.fcustcode,
            customerpalletid: PHY_MST.fcustpalid,
            palletid: PHY_MST.fpalletid,
            pcedihppvalue: pcEDIHPPValue,
            plfoundedihpphold: '',
            plusestackhold: '',
          },
        );
        if (rfInbounds && rfInbounds.output) {
          plUseStackHold = rfInbounds.output.plusestackhold !== 0;
          // plFoundEDIHPPHold = rfInbounds.output.plfoundedihpphold !== 0;
          pcEDIHPPValue = rfInbounds.output.pcedihppvalue;
        }

        PHY_MST.fishpp = true;
        PHY_MST.fhold = pcEDIHPPValue;
        if (plUseStackHold) {
          await this.storedProceduresNewService.getWcsStackholdscreationandrelease(
            {
              holdcode: pcEDIHPPValue,
              holdenteredby: fwho,
              holdorrelease: 'H',
              newholdcomment: '',
              newstatus: '',
              oneside: '',
              palletorlot: 'P',
              releasecomment: '',
              serial: PHY_MST.fserial,
              track: PHY_MST.ftrack,
            },
          );
        } else {
          PHY_MST.fhold = pcEDIHPPValue;
        }
        PHY_MST.fhold = pcEDIHPPValue;
        await this.manager()
          .query(
            `BEGIN UPDATE PHY_MST SET fishpp = '${PHY_MST.fishpp}', fhold = '${PHY_MST.fhold}' WHERE ID = '${PHY_MST.id}'; END`,
          )
          .catch(err => {
            this.logger.error(
              {
                fishpp: PHY_MST.fishpp,
                fhold: PHY_MST.fhold,
                id: PHY_MST.id,
                fpalletid: recvo.lc_pal,
              },
              'Error in PHY_MST UPDATE Query',
              'RECEIVING > PROCESS_HPP',
            );
            throw err;
          });
        //await this.phymstRepo().save(PHY_MST);
      }
      recvo.lc_isHPP = lcIsHPP;
      recvo.lc_oldisHPP = lcIsHPP;
    }
  }

  async processLotNo(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    let outkey = '';
    const scrnUI = [];
    let data;
    let lcdte = '';
    let lcjdte = '';
    let lcbbdte = '';
    let lcBBJULIAN = '';
    let footerData = `${constant.F5_EXIT}`;
    // line 1521 - ** GET LOT NUMBER

    if (recvo.lc_keylot === 'Y') {
      let lcLot = '';
      if (body.lot && body.lot.trim().length > 0) {
        lcLot = body.lot
          .trim()
          .toUpperCase()
          .slice(0, 16);

        // Special code for Windsor Foods(0008873) per Jammie - RWM 09 / 20 / 2017
        // Format xxxxx - LL - L - LLLLx - xxxxx, we want all of the L's togeather as a lot
        // Assume vaiable length for everything except LLLLx(this is the julian date in YDDD format).

        if (
          lcLot &&
          lcLot.length > 0 &&
          (recvo.lc_CustCode.trim() === '0008873' ||
            recvo.lc_CustCode.trim() === '0010562')
        ) {
          // // and ATC('-', lcLot, 4) > 0
          // lcLot = SUBSTR(lcLot, ATC('-', lcLot, 1) + 1, ATC('-', lcLot, 2) - ATC('-', lcLot, 1) - 1) + ;
          // SUBSTR(lcLot, ATC('-', lcLot, 2) + 1, ATC('-', lcLot, 3) - ATC('-', lcLot, 2) - 1) + ;
          // SUBSTR(lcLot, ATC('-', lcLot, 3) + 1, ATC('-', lcLot, 4) - ATC('-', lcLot, 3) - 2) && -2 since we don't want the last character
        }
        if (lcLot && lcLot.length > 0) {
          lcLot = lcLot
            .trim()
            .toUpperCase()
            .slice(0, 16);
          recvo.lc_lot = lcLot;
          recvo.lc_oldlot = lcLot;

          if (recvo.pl_AutoDateForProdLot && recvo.lc_keylot === 'Y') {
            // const rfLot = await this.storedProceduresNewService.getGetdatesfromproductandlot(
            //   {
            //     inBatch: recvo.lc_batch,
            //     inLot: recvo.lc_lot,
            //     inProduct: recvo.lc_prod,
            //     outBbcodedate: '',
            //     outBbjuliandate: '',
            //     outCodedate: '',
            //     outJuliandate: '',
            //   },
            // );
            const rfLot = await this.manager().query(`
                BEGIN
                  DECLARE	@return_value int,
                  @Out_CodeDate char(8),
                  @Out_JulianDate char(7),
                  @Out_BBCodeDate char(8),
                  @Out_BBJulianDate char(7)
                  EXEC	@return_value = [dbo].[usp_GetDatesFromProductAndLot]
                  @In_Batch = N'${recvo.lc_batch}',
                  @In_Product = N'${recvo.lc_prod}',
                  @In_Lot = N'${recvo.lc_lot}',
                  @Out_CodeDate = @Out_CodeDate OUTPUT,
                  @Out_JulianDate = @Out_JulianDate OUTPUT,
                  @Out_BBCodeDate = @Out_BBCodeDate OUTPUT,
                  @Out_BBJulianDate = @Out_BBJulianDate OUTPUT

                  SELECT	@Out_CodeDate as N'@Out_CodeDate',
                  @Out_JulianDate as N'@Out_JulianDate',
                  @Out_BBCodeDate as N'@Out_BBCodeDate',
                  @Out_BBJulianDate as N'@Out_BBJulianDate'
                END`);

            if (rfLot && rfLot.length > 0) {
              // if (rfLot && rfLot.output) {
              lcdte =
                recvo.lc_dtetyp === 'J'
                  ? rfLot[0]['@Out_JulianDate'].length > 0
                    ? rfLot[0]['@Out_JulianDate'].trim()
                    : recvo.lc_dte
                  : rfLot[0]['@Out_CodeDate'].length > 0
                  ? rfLot[0]['@Out_CodeDate'].trim()
                  : recvo.lc_dte;
              lcjdte =
                rfLot[0]['@Out_JulianDate'].length > 0
                  ? rfLot[0]['@Out_JulianDate'].trim()
                  : recvo.lc_jdte;
              lcbbdte =
                recvo.lc_bbdtetype === '1'
                  ? rfLot[0]['@Out_BBJulianDate'].length > 0
                    ? rfLot[0]['@Out_BBJulianDate'].trim()
                    : recvo.lc_bbdte
                  : rfLot[0]['@Out_BBCodeDate'].length > 0
                  ? rfLot[0]['@Out_BBCodeDate'].trim()
                  : recvo.lc_bbdte;
              lcBBJULIAN =
                rfLot[0]['@Out_BBJulianDate'].length > 0
                  ? rfLot[0]['@Out_BBJulianDate'].trim()
                  : recvo.lc_BBJULIAN;
              this.logger.debug(
                'receiving -->',
                `lot dates --> ${lcdte}, ${lcjdte}, ${lcbbdte}, ${lcBBJULIAN}`,
              );
            }
          }

          recvo.curOper = this.findNextState(recvo);
          if (recvo.curOper === ReceivingState.MARK_PROCESS_DATE) {
            outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
            const d = getFields(
              recvo.lc_dtetyp === 'J'
                ? ReceivingState.SHOW_PROCESS_JDATE
                : ReceivingState.SHOW_PROCESS_CDATE,
            );
            d.defaultVal = lcdte || '';
            scrnUI.push(d);
          }
          if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
            const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
            q.defaultVal = recvo.curTempVal;
            scrnUI.push(q);
          }
          if (recvo.curOper === ReceivingState.MARK_PROCESS_CLOT) {
            const clot = getFields(ReceivingState.MARK_PROCESS_CLOT);
            if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
              clot.maxFieldLen = recvo.RFREQ.fscanlngth;
            scrnUI.push(clot);
          }
          if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
            // const o: OSummary = new OSummary();
            // o.labels = this.summary(recvo);
            // if (o.labels.length > 0) {
            //   scrnUI.push(o);
            // }
            data = { label: getLabelFields('assumeText') };
            footerData = `${constant.F7_DIMS}`;
            scrnUI.push(...this.summary2(recvo));
            //dynamic attribute code added
            const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
            scrnUI.push(...dynamicAttributes); // Push dynamic attribute data
          } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
            const CODE2 = (recvo.CODE2 as unknown) as Code2;
            const lcConscode =
              recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
                ? CODE2.fproduct.slice(0, 3)
                : '';
            const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
            c.label = recvo.pnHandKeyConsigneeCross
              ? constant.CONSIGNEE
              : constant.SCAN_CONSIGNEE;
            c.defaultVal = lcConscode;
            c.value = lcConscode;
            c.isScanable = recvo.pnHandKeyConsigneeCross;
            scrnUI.push(c);
          } else if (
            recvo.ll_ASNpal &&
            recvo.curOper === ReceivingState.MARK_PROCESS_REF
          ) {
            let ediPal = await this.editPAlRepo().findOne({
              where: {
                fbatch: recvo.lc_batch,
                fpalletid: recvo.lc_pal,
              },
              order: {
                fbatch: 'ASC',
                fpalletid: 'ASC',
              },
            });

            if (ediPal && ediPal.fpalletid.length > 0) {
              recvo.lc_ref = ediPal?.flotref ? ediPal?.flotref?.trim() : '';
              recvo.lc_bbdte = ediPal?.fbbcodedte
                ? moment(ediPal?.fbbcodedte, 'YYYY-MM-DD').format('MMDDYYYY')
                : '';
            }
            const c = getFields(ReceivingState.MARK_PROCESS_REF);
            c.label = constant.REF.trim();
            c.defaultVal = recvo.lc_ref;
            c.value = recvo.lc_ref;
            scrnUI.push(c);
          }
          await this.cacheService.setcache(fwho, RECEIVING, recvo);
          errMsg = '';
        } else {
          errMsg = constant.LOT_NOT_BLANK;
        }
      } else {
        errMsg = constant.LOT_NOT_BLANK;
      }
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg,
        infoMsg: '',
        scrnUI,
        data,
      }),
      outkey ? getOutputFields(outkey) : getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processCustLotNo(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    const scrnUI = [];
    let data;
    let footerData = `${constant.F5_EXIT}`;
    // line 1694 - ** GET CUSTOMER LOT NUMBER
    let lcClot = '';
    if (body.clot && body.clot.trim().length > 0) {
      lcClot = body.clot.trim().toUpperCase();
      recvo.lc_clot = lcClot;
      recvo.curOper = this.findNextState(recvo);
      if (recvo.curOper === ReceivingState.MARK_PROCESS_CLOT) {
        const clot = getFields(ReceivingState.MARK_PROCESS_CLOT);
        if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
          clot.maxFieldLen = recvo.RFREQ.fscanlngth;
        scrnUI.push(clot);
      }
      if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
        const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
        q.defaultVal = recvo.curTempVal;
        scrnUI.push(q);
      }
      if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
        // const o: OSummary = new OSummary();
        // o.labels = this.summary(recvo);
        // if (o.labels.length > 0) {
        //   scrnUI.push(o);
        // }
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS}`;
        scrnUI.push(...this.summary2(recvo));
        //dynamic attribute code added
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
        scrnUI.push(...dynamicAttributes);
      } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
        const CODE2 = (recvo.CODE2 as unknown) as Code2;
        const lcConscode =
          recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
            ? CODE2.fproduct.slice(0, 3)
            : '';
        const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
        c.label = recvo.pnHandKeyConsigneeCross
          ? constant.CONSIGNEE
          : constant.SCAN_CONSIGNEE;
        c.defaultVal = lcConscode;
        c.value = lcConscode;
        c.isScanable = recvo.pnHandKeyConsigneeCross;
        scrnUI.push(c);
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
      errMsg = '';
    } else {
      errMsg = constant.CLOT_NOT_BLANK;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processEST(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    const scrnUI = [];
    let data;
    let footerData = `${constant.F5_EXIT}`;
    // line 1825 - ** GET ESTABLISHMENT NUMBER
    if (recvo.lc_keyestb === 'Y' && !recvo.ll_usedF6) {
      let lcEstb = '';
      if (body.estb && body.estb.trim().length > 0) {
        lcEstb = body.estb.trim().toUpperCase();
        recvo.lc_estb = lcEstb;

        recvo.curOper = this.findNextState(recvo);
        if (recvo.curOper === ReceivingState.MARK_PROCESS_CLOT) {
          const clot = getFields(ReceivingState.MARK_PROCESS_CLOT);
          if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
            clot.maxFieldLen = recvo.RFREQ.fscanlngth;
          scrnUI.push(clot);
        }
        if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
          const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
          q.defaultVal = recvo.curTempVal;
          scrnUI.push(q);
        }
        if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
          // const o: OSummary = new OSummary();
          // o.labels = this.summary(recvo);
          // if (o.labels.length > 0) {
          //   scrnUI.push(o);
          // }
          data = { label: getLabelFields('assumeText') };
          footerData = `${constant.F7_DIMS}`;
          scrnUI.push(...this.summary2(recvo));
          //dynamic attribute code added
          const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
          scrnUI.push(...dynamicAttributes);
        } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
          const CODE2 = (recvo.CODE2 as unknown) as Code2;
          const lcConscode =
            recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
              ? CODE2.fproduct.slice(0, 3)
              : '';
          const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
          c.label = recvo.pnHandKeyConsigneeCross
            ? constant.CONSIGNEE
            : constant.SCAN_CONSIGNEE;
          c.defaultVal = lcConscode;
          c.value = lcConscode;
          c.isScanable = recvo.pnHandKeyConsigneeCross;
          scrnUI.push(c);
        }
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
      } else {
        errMsg = constant.EST_NOT_BLANK;
      }
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processSDate(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    const scrnUI = [];
    let data;
    let footerData = `${constant.F5_EXIT}`;
    // line 1857 - ** GET SLAUGHTER DATE
    let lcSlaughdte = '';
    if (body.sDte && body.sDte.trim().length > 0) {
      lcSlaughdte = body.sDte.trim();
      lcSlaughdte = lcSlaughdte.slice(0, 10);

      if (
        lcSlaughdte &&
        (lcSlaughdte.length === 7 || lcSlaughdte.length === 8)
      ) {
        if (lcSlaughdte.length === 7) {
          // && Julian Date
          const lnslyear = Number(lcSlaughdte.slice(0, 4));
          const lnslday = Number(lcSlaughdte.slice(4, 7));
          const ldSlpdate = moment(this.RFJTOD(lcSlaughdte), 'MMDDYYYY'); // production date
          const y: number = moment().year();
          if (!(lnslyear >= y - 2 && lnslyear <= y)) {
            errMsg = constant.INVALID_YEAR;
          } else if (errMsg === '' && !(lnslday >= 1 && lnslday <= 366)) {
            errMsg = constant.INVALID_DAY;
          } else if (errMsg === '' && ldSlpdate.diff(moment(), 'hours') > 0) {
            errMsg = constant.SLAUGH_DTE;
          }
        } else if (lcSlaughdte.length === 8) {
          // && IS A GREGORIAN DATE
          const ldSlpdate = moment(body.sDte, 'MMDDYYYY');
          const lnslyear = ldSlpdate.year();
          const lnslday = ldSlpdate.date();
          const lnslmonth = ldSlpdate.month();
          const y: number = moment().year();
          if (!(lnslyear >= y - 2 && lnslyear <= y)) {
            errMsg = constant.INVALID_YEAR;
          } else if (errMsg === '' && !(lnslday >= 1 && lnslday <= 31)) {
            errMsg = constant.INVALID_DAY;
          } else if (errMsg === '' && !(lnslmonth >= 0 && lnslmonth <= 11)) {
            errMsg = constant.INVALID_MONTH;
          } else if (errMsg === '' && ldSlpdate.diff(moment(), 'hours') > 0) {
            errMsg = constant.SLAUGH_DTE;
          }
        } else {
          lcSlaughdte = '';
        }
      } else {
        errMsg = constant.DTE_LENGTH;
      }
    } else {
      lcSlaughdte = '';
    }

    if (errMsg === '') {
      recvo.lc_slaughdte = lcSlaughdte;
      recvo.curOper = this.findNextState(recvo);
      if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
        const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
        q.defaultVal = recvo.curTempVal;
        scrnUI.push(q);
      }
      if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
        // const o: OSummary = new OSummary();
        // o.labels = this.summary(recvo);
        // if (o.labels.length > 0) {
        //   scrnUI.push(o);
        // }
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS}`;
        scrnUI.push(...this.summary2(recvo));
        //dynamic attribute code added
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
        scrnUI.push(...dynamicAttributes);
      } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
        const CODE2 = (recvo.CODE2 as unknown) as Code2;
        const lcConscode =
          recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
            ? CODE2.fproduct.slice(0, 3)
            : '';
        const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
        c.label = recvo.pnHandKeyConsigneeCross
          ? constant.CONSIGNEE
          : constant.SCAN_CONSIGNEE;
        c.defaultVal = lcConscode;
        c.value = lcConscode;
        c.isScanable = recvo.pnHandKeyConsigneeCross;
        scrnUI.push(c);
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processRef(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const errMsg = '';
    let data;
    let footerData = `${constant.F5_EXIT}`;
    // line 1947 - ** GET LOT REFERENCE #
    let lcRef = '';
    if (body.ref && body.ref.trim().length > 0) {
      lcRef = body.ref.trim().slice(0, 15);
    }
    recvo.lc_ref = lcRef;
    recvo.curOper = this.findNextState(recvo);
    const scrnUI = [];
    if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
      const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
      q.defaultVal = recvo.curTempVal;
      scrnUI.push(q);
    }
    if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
      // const o: OSummary = new OSummary();
      // o.labels = this.summary(recvo);
      // if (o.labels.length > 0) {
      //   scrnUI.push(o);
      // }
      data = { label: getLabelFields('assumeText') };
      footerData = `${constant.F7_DIMS}`;
      scrnUI.push(...this.summary2(recvo));
      //dynamic attribute code added
      const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
      scrnUI.push(...dynamicAttributes);
    } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
      const CODE2 = (recvo.CODE2 as unknown) as Code2;
      const lcConscode =
        recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
          ? CODE2.fproduct.slice(0, 3)
          : '';
      const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
      c.label = recvo.pnHandKeyConsigneeCross
        ? constant.CONSIGNEE
        : constant.SCAN_CONSIGNEE;
      c.defaultVal = lcConscode;
      c.value = lcConscode;
      c.isScanable = recvo.pnHandKeyConsigneeCross;
      scrnUI.push(c);
    }
    await this.cacheService.setcache(fwho, RECEIVING, recvo);

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processTemp(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const errMsg = '';
    let data;
    let footerData = `${constant.F5_EXIT}`;
    // line 1947 - 2390 ** GET TEMP
    let lcTemp = '';
    if (body.temp && body.temp.toString().trim().length > 0) {
      lcTemp = body.temp.toString().trim();
      try {
        let tempNo = 0;
        if (!Number.isNaN(Number(lcTemp))) {
          tempNo = Number(
            (lcTemp.split('.') || []).length > 1
              ? Number(lcTemp).toFixed(2)
              : lcTemp,
          );
          tempNo =
            Math.abs(tempNo) > 999_999
              ? Number(tempNo.toString().slice(0, 6))
              : tempNo;
        }
        lcTemp = tempNo.toString();
      } catch {
        lcTemp = '0';
      }
    }
    recvo.lc_temp = lcTemp;
    recvo.curTempVal = lcTemp;
    recvo.curOper = this.findNextState(recvo);
    const scrnUI = [];
    if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
      // const o: OSummary = new OSummary();
      // o.labels = this.summary(recvo);
      // if (o.labels.length > 0) {
      //   scrnUI.push(o);
      // }
      data = { label: getLabelFields('assumeText') };
      footerData = `${constant.F7_DIMS}`;
      scrnUI.push(...this.summary2(recvo));
      //dynamic attribute code added
      const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
      //scrnUI.push({'dynamicAttr' : dynamicAttributes});
      scrnUI.push(...dynamicAttributes); // Push dynamic attribute data
    } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
      const CODE2 = (recvo.CODE2 as unknown) as Code2;
      const lcConscode =
        recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
          ? CODE2.fproduct.slice(0, 3)
          : '';
      const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
      c.label = recvo.pnHandKeyConsigneeCross
        ? constant.CONSIGNEE
        : constant.SCAN_CONSIGNEE;
      c.defaultVal = lcConscode;
      c.value = lcConscode;
      c.isScanable = recvo.pnHandKeyConsigneeCross;
      scrnUI.push(c);
    } else if (
      recvo.ll_ASNpal &&
      recvo.curOper === ReceivingState.MARK_PROCESS_BB_DATE
    ) {
      const c = getFields(ReceivingState.MARK_PROCESS_BB_DATE);
      c.label = constant.BEST_B4_DATE.trim();
      let date =
        recvo.lc_dtetyp === 'J'
          ? recvo.lc_jdte
          : recvo.lc_bbdte !== ''
          ? moment(recvo.lc_bbdte, 'MMDDYYYY').format('MM/DD/YYYY')
          : recvo.lc_bbdte;
      c.defaultVal = date;
      c.value = date;
      scrnUI.push(c);
    }
    await this.cacheService.setcache(fwho, RECEIVING, recvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${footerData}`,
    );
  }

  async processBBdate(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
    footer: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    const scrnUI = [];
    const CODE2 = (recvo.CODE2 as unknown) as Code2;
    let configData: any = recvo?.CONFIG;
    let localeObj: any = {};
    if (configData && configData?.locale) {
      localeObj = JSON.parse(configData.locale);
    } else {
      [configData] = await this.manager().query(
        `SELECT TOP 1 locale from CONFIG`,
      );
      localeObj = JSON.parse(configData?.locale) || {};
    }
    let selectedFormat;
    let currenDtFormat;
    if (localeObj) {
      selectedFormat =
        localeObj.fDtFormat && localeObj.fDtFormat.length > 0
          ? localeObj.fDtFormat[0]
          : 'MM/DD/YYYY'; // MM/DD/YYYY
      currenDtFormat = selectedFormat.replace(new RegExp('/', 'g'), ''); // MMDDYYYY
    }

    // line 2010 Assumes it will come in as Julian "YYYYDDD"
    if (recvo.lc_bbdtetype === '1') {
      const l =
        body.bbjDte && body.bbjDte.trim()?.length > 0
          ? body.bbjDte?.trim()?.length
          : 0;
      let lcDte = body?.bbjDte?.trim();
      lcDte =
        l === 4
          ? `${moment()
              .year()
              .toString()
              .slice(0, 2)}${lcDte}`
          : lcDte;
      if (l === 0) {
        errMsg = constant.DATE_EMPTY;
      } else if (
        recvo.plCalcPRBBDate &&
        (recvo.lc_dte.length === 0 || recvo.ll_ASNpal) &&
        body.bbjDte &&
        l === 7
      ) {
        const result = await this.storedProceduresNewService.getRfCalculateproductionorbestbydate(
          {
            bestbycodedate: '01/01/1991',
            bestbyjulian: body.bbjDte.trim(),
            codedate: '01/01/1991',
            customercode: recvo.CODE2.fcustcode,
            juliandate: '',
            owner: recvo.CODE2.fowner,
            product: recvo.CODE2.fproduct,
            productgroup: recvo.CODE2.fprodgroup,
            supplierproduct: recvo.CODE2.fsuplrprod,
          },
        );
        const outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
        if (result && result.output) {
          recvo.curOper = ReceivingState.MARK_PROCESS_DATE;
          const d = getFields(
            recvo.lc_dtetyp === 'J'
              ? ReceivingState.SHOW_PROCESS_JDATE
              : ReceivingState.SHOW_PROCESS_CDATE,
          );
          d.defaultVal =
            recvo.lc_dtetyp === 'J'
              ? result.output.juliandate
              : moment(result.output.codedate).format('MMDDYYYY');
          d.value =
            recvo.lc_dtetyp === 'J'
              ? result.output.juliandate
              : moment(result.output.codedate).format('MMDDYYYY');
          scrnUI.push(d);
        }
        const ldcdate = moment(lcDte, 'YYYYDDD');
        recvo.lc_BBJULIAN = body.bbjDte;
        recvo.lc_bbdte = ldcdate.format('MMDDYYYY');

        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const data = { CODE2: recvo.CODE2, footer };
        return new ResponseKeysDTO(
          plainToClass(PostResponseReceivingDTO, {
            curOper: recvo.curOper,
            errMsg: '',
            scrnUI,
            data,
          }),
          getOutputFields(outkey),
          '',
          '',
          `${constant.F2_SKIP}~${constant.F5_EXIT}`,
        );
      } else if (body.bbjDte && l === 7) {
        const ldcdate = moment(lcDte, 'YYYYDDD');
        const lncday = Number(lcDte.slice(4, 7));
        const d = moment();
        const lneDate =
          recvo.lc_dtetyp === 'J'
            ? moment(this.RFJTOD(recvo.lc_dte), 'MMDDYYYY')
            : moment(recvo.lc_dte, 'MMDDYYYY');
        lneDate.add(CODE2.fshelflife, 'days');
        if (
          ldcdate.isValid() &&
          !ldcdate.isBetween(
            moment(lneDate)
              .subtract(recvo.ln_yearsback, 'year')
              .subtract(1, 'days'),
            moment(lneDate)
              .add(1, 'year')
              .add(1, 'days'),
          )
        ) {
          errMsg = constant.INVALID_JUL_YR;
          const lccdterr = `Batch ${recvo.lc_batch} \n Pallet ${
            recvo.lc_pal
          } had Julian Date ${lcDte} put in. This date was Incorrect as the year was not within ${recvo.ln_yearsback
            .toString()
            .trim()} yr back or 1 yr forward of ${d.format(
            selectedFormat,
          )}\n  PickCode is ${CODE2.fpickcode} Shelflife is ${
            CODE2.fshelflife
          }`;
          await this.WRITEINVCONTROL(
            fwho,
            recvo,
            'JULIAN YEAR IS INCORRECT',
            lccdterr,
            true,
          );
        } else if (errMsg === '' && !(lncday >= 1 && lncday <= 366)) {
          errMsg = constant.INVALID_JUL_DAY;
          const lccdterr = `Batch ${recvo.lc_batch} \n Pallet ${recvo.lc_pal} had Julian Date ${lcDte} put in.This date was Incorrect as the day was not between 1 and 366. \n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            recvo,
            'JULIAN DAY IS INCORRECT',
            lccdterr,
            true,
          );
        } /* NOT executing EXP_DATE
        else if (errMsg === '' && ldcdate.diff(moment(), 'days') < 30) {
          errMsg = constant.EXP_DATE;
          const lccdterr = `Batch ${recvo.lc_batch} \n Pallet ${recvo.lc_pal} had Best Before Julian Date ${lcDte} put in. \n The Best Before date is ${ldcdate.format('MM/DD/YYYY')}  This date is a problem as the Expiration date is < 30 days. \n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(fwho, recvo, "JULIAN EXPIRATION < 30", lccdterr, false);
        } */ else {
          recvo.lc_BBJULIAN = body.bbjDte;
          recvo.lc_bbdte = ldcdate.format('MMDDYYYY'); // todao check code later lc_BBJULIAN > rjod > MMDDYYYY
        }
      } else {
        errMsg = constant.INVALID_JUL_DATE;
        const lccdterr = `Batch ${recvo.lc_batch} \n Pallet ${recvo.lc_pal} had Julian Date ${lcDte} put in. This date was Incorrect as it was not 7 Characters long.\n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife}`;
        await this.WRITEINVCONTROL(
          fwho,
          recvo,
          'JULIAN IS NOT 7 CHAR LONG',
          lccdterr,
          true,
        );
      }
    } else {
      // line 2633 Date coming in will be MMDDYY or MMDDYYYY
      const l =
        body.bbcDte && body.bbcDte.trim()?.length > 0
          ? body.bbcDte.trim()?.length
          : 0;
      const lcDte = body?.bbcDte?.trim();
      if (l === 0) {
        errMsg = constant.DATE_EMPTY;
      } else if (errMsg === '' && lcDte && (l === 6 || l === 8)) {
        const ldcdate =
          lcDte.length === 6
            ? moment(lcDte, 'MMDDYY')
            : moment(lcDte, 'MMDDYYYY');
        const d = moment(ldcdate, 'MMDDYYYY').isValid();
        if (d) {
          const rfjTodFormat =
            lcDte?.trim().length == 8 ? lcDte : this.RFJTOD(lcDte);
          const lneDate =
            recvo.lc_dtetyp === 'J'
              ? moment(rfjTodFormat, 'MMDDYYYY')
              : moment(rfjTodFormat, 'MMDDYYYY');
          lneDate.add(CODE2.fshelflife, 'days');
          if (
            !ldcdate.isBetween(
              moment(lneDate)
                .subtract(recvo.ln_yearsback, 'year')
                .subtract(1, 'days'),
              moment(lneDate)
                .add(1, 'year')
                .add(1, 'days'),
            )
          ) {
            errMsg = constant.INVALID_BEST_DATE;
            const lcCdterr = `Batch ${
              recvo.lc_batch
            } \n Pallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} had  Best Before Code Date ${ldcdate
              .format(currenDtFormat)
              .toString()} put in. This date was Incorrect as the date was not between ${moment()
              .subtract(1, 'year')
              .format(selectedFormat)
              .toString()} and ${moment()
              .add(1, 'year')
              .format(selectedFormat)
              .toString()} \n PickCode is  ${CODE2.fpickcode} Shelflife is ${
              CODE2.fshelflife
            }`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'BEST BEFORE DATE YEAR IS INCOR',
              lcCdterr,
              true,
            );
          }
          recvo.lc_bbdte = ldcdate.format('MMDDYYYY');
        } else {
          errMsg = constant.INVALID_BEST_DATE;
        }
      } else {
        errMsg = constant.INVALID_BEST_DATE;
      }
    }
    let data = { footer: undefined, label: {} };
    // let data = { footer: undefined, label: {} };
    if (errMsg === '') {
      /**
       * Added this code for enter julian expire in inventory control
       */
      let ldcdate = moment();
      if (recvo.lc_bbdtetype === '1') {
        ldcdate = moment(body.bbjDte, 'YYYYDDD');
      } else {
        const lcDte = body?.bbcDte?.trim();
        ldcdate =
          lcDte.length === 6
            ? moment(lcDte, 'MMDDYY').format('YYYYDDD')
            : moment(lcDte, 'MMDDYYYY').format('YYYYDDD');
        // -ldcdate = moment('2024020', 'YYYYDDD')
        ldcdate = moment(ldcdate, 'YYYYDDD');
      }
      if (ldcdate.diff(moment(), 'days') < 30) {
        const lccdterr = `Batch ${recvo.lc_batch} \nPallet ${
          recvo.lc_pal
        } had Best Before Julian Date ${ldcdate.format(
          'YYYYDDD',
        )} put in. \nThe Best Before date is ${ldcdate.format(
          selectedFormat,
        )}  This date is a problem as the Expiration date is < 30 days. \nPickCode is ${
          CODE2.fpickcode
        } Shelflife is ${CODE2.fshelflife}`;
        await this.WRITEINVCONTROL(
          fwho,
          recvo,
          'JULIAN EXPIRATION < 30',
          lccdterr,
          false,
        );
      }
      if (recvo.plCalcPRBBDate && recvo.lc_dte.length === 0) {
        const result = await this.storedProceduresNewService.getRfCalculateproductionorbestbydate(
          {
            bestbycodedate: ldcdate.format('MM/DD/YYYY'),
            bestbyjulian: '',
            codedate: '01/01/1991',
            customercode: recvo.CODE2.fcustcode,
            juliandate: '',
            owner: recvo.CODE2.fowner,
            product: recvo.CODE2.fproduct,
            productgroup: recvo.CODE2.fprodgroup,
            supplierproduct: recvo.CODE2.fsuplrprod,
          },
        );
        const outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
        if (result && result.output) {
          recvo.curOper = ReceivingState.MARK_PROCESS_DATE;
          const dt = getFields(
            recvo.lc_dtetyp === 'J'
              ? ReceivingState.SHOW_PROCESS_JDATE
              : ReceivingState.SHOW_PROCESS_CDATE,
          );
          dt.defaultVal =
            recvo.lc_dtetyp === 'J'
              ? result.output.juliandate
              : moment(result.output.codedate).format('MMDDYYYY');
          dt.value =
            recvo.lc_dtetyp === 'J'
              ? result.output.juliandate
              : moment(result.output.codedate).format('MMDDYYYY');
          scrnUI.push(dt);
        }
        recvo.lc_bbdte = ldcdate.format('MMDDYYYY');

        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const data = { CODE2: recvo.CODE2, footer };
        return new ResponseKeysDTO(
          plainToClass(PostResponseReceivingDTO, {
            curOper: recvo.curOper,
            errMsg: '',
            scrnUI,
            data,
          }),
          getOutFieldState(outkey),
          '',
          '',
          `${constant.F2_SKIP}~${constant.F5_EXIT}`,
        );
      }

      recvo.lc_oldbbdte = recvo.lc_bbdte;
      recvo.curOper = this.findNextState(recvo);
      if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
        const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
        q.defaultVal = recvo.curTempVal;
        scrnUI.push(q);
      }
      if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
        // const o: OSummary = new OSummary();
        // o.labels = this.summary(recvo);
        // if (o.labels.length > 0) {
        //   scrnUI.push(o);
        // }
        data = { footer: undefined, label: getLabelFields('assumeText') };
        scrnUI.push(...this.summary2(recvo));
        //dynamic attribute code added
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
        scrnUI.push(...dynamicAttributes); // Push dynamic attribute data
      } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
        const lcConscode =
          recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
            ? CODE2.fproduct.slice(0, 3)
            : '';
        const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
        c.label = recvo.pnHandKeyConsigneeCross
          ? constant.CONSIGNEE
          : constant.SCAN_CONSIGNEE;
        c.defaultVal = lcConscode;
        c.value = lcConscode;
        c.isScanable = recvo.pnHandKeyConsigneeCross;
        scrnUI.push(c);
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }
    if (
      recvo.plCalcPRBBDate &&
      (recvo.lc_bbdtetype === '1' || recvo.lc_bbdtetype === '2')
    ) {
      data = { footer, label: '' };
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      data?.footer
        ? `${constant.F2_SKIP}~${constant.F5_EXIT}`
        : recvo.curOper === ReceivingState.MARK_SEND_PALLET
        ? `${constant.F7_DIMS}`
        : `${constant.F5_EXIT}`,
    );
  }

  async processConsignee(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    const scrnUI = [];
    let data;
    let footerData = `${constant.F5_EXIT}`;
    if (
      body?.consig &&
      body.consig.trim().length > 0 &&
      (await this.validConsignee(body?.consig))
    ) {
      recvo.lcConscode = body.consig.trim();
      recvo.curOper = this.findNextState(recvo);
      if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
        const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
        q.defaultVal = recvo.curTempVal;
        scrnUI.push(q);
      }
      if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS}`;
        scrnUI.push(...this.summary2(recvo));
        //dynamic attribute code added
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, recvo.lc_batch);
        scrnUI.push(...dynamicAttributes); // Push dynamic attribute data
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else {
      recvo.lcConscode = '';
      errMsg = recvo.pnHandKeyConsigneeCross
        ? constant.ENTER_VALID_CONSIGNEE
        : constant.SCAN_VALID_CONSIGNEE;
      const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
      c.label = recvo.pnHandKeyConsigneeCross
        ? constant.CONSIGNEE
        : constant.SCAN_CONSIGNEE;
      c.defaultVal = '';
      c.value = '';
      c.isScanable = recvo.pnHandKeyConsigneeCross;
      scrnUI.push(c);
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processSendPallet(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    //  line 2270 - SEND PALLET INFO?
    const scrnUI = [];
    recvo.pcPalletToCheck = recvo.lc_pal;
    if (body.sndPal && ['Y', ''].includes(body.sndPal.trim().toUpperCase())) {
      recvo.ln_intie = body.ti && body.ti > 0 ? body.ti : 0;
      recvo.pnHeight = body.height && body.height > 0 ? body.height : 0;
      recvo.pnWidth = body.width && body.width > 0 ? body.width : 0;
      recvo.pnLength = body.lngth && body.lngth > 0 ? body.lngth : 0;
      return this.INCREATE(fwho, recvo, body, constant);
    }
    const infoMsg = constant.DATA_NOT_SENT;
    const CONFIG = (recvo.CONFIG as unknown) as Config;
    const glOfcputflag = CONFIG?.ofcputflag === true;
    if (recvo.lc_pal && recvo.lc_pal.length > 0) {
      const PHYMSTres = await this.manager().query(
        `BEGIN SELECT TOP 1 id, ftrack, fqty, TRIM(flocation) flocation FROM dbo.PHY_MST WHERE fpalletid = '${recvo.lc_pal}' order by fpalletid ASC ; END`,
      );
      const PHY_MST: PhyMst = PHYMSTres[0];
      if (
        PHY_MST &&
        PHY_MST.ftrack.slice(7, 10).trim() === '' &&
        PHY_MST.fqty === 0
      ) {
        const lcInoldloc = PHY_MST.flocation;
        // await this.phymstRepo().delete({ id: PHY_MST.id });
        await this.manager().query(
          `BEGIN  DELETE FROM [dbo].[PHY_MST] WHERE id = ${PHY_MST.id}; END`,
        );
        if (
          glOfcputflag &&
          lcInoldloc &&
          lcInoldloc.length > 0 &&
          lcInoldloc !== 'UNASSIGNED'
        ) {
          await this.UpDteLoc(lcInoldloc);
        }
      }
    }
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
      recvo.lineageFreightManagement && ['L', 'D', 'S'].includes(recvo.quickRec?.fquickrcv?.trim())
        ? `${constant.F5_EXIT}`
        : `${constant.F5_EXIT}~${constant.F8_LABL}`,
    );
  }

  async processPalletType(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    if (
      body.palType &&
      body.palType.trim().length > 0 &&
      (await this.InmanPalletTypeIngestion(recvo, recvo.lc_pal, body.palType))
    ) {
      recvo.curOper = await this.processPallHist(fwho, recvo, constant);
    } else {
      errMsg = constant.PALLET_SELECT;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processPallHist(
    fwho: string,
    recVO: ReceivingVO,
    constant: any,
  ): Promise<string> {
    const recvo = recVO;
    let result = '';

    const PALLHIST = `INSERT INTO PALLHIST (fworktype, fpalletid, flocfrom, flocto, foperid, fdatestamp, fequipid, fhandpal, fhandloc, fcustcode, fqty, fbatch)
      VALUES (
        'RECEIVE',
        '${recvo.lc_pal}',
        'WALK',
        '${recvo.llQuickrcv ? 'UNASSIGNEQ' : 'UNASSIGNED'}',
        '${fwho}',
        '${this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS')}',
        '',
        'false',
        'false',
        '${recvo.LOADIN.fcustcode}',
        '${Number.isNaN(recvo.lc_qty) ? 0 : Number(recvo.lc_qty)}',
        '${recvo.LOADIN.fbatch}'
    )`;
    const palHistlmsQuery = `
      ${PALLHIST};
      DECLARE @lmsId int;
      SELECT TOP 1 @lmsId = id from LMSCAN where palletid = '${
        recvo.lc_pal
      }' order by palletid;
      IF @lmsId IS NULL
        BEGIN
          INSERT INTO LMSCAN (operatorid, palletid, firstloc, origloc, machserial, roomloc, active, assignment, droploc, stage, worktype, iscomplete, datetime)
          VALUES (
            '${fwho}',
            '${recvo.lc_pal}',
            '',
            'WALK',
            '',
            '',
            'false',
            'false',
            '',
            '',
            'RECEIVE',
            'N',
            '${this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS')}'
          )
        END
    `;
    await this.manager()
      .query(palHistlmsQuery)
      .catch(error => {
        this.logger.error(
          { fpalletid: recvo.lc_pal },
          'Error in PALHIST/LMSCAN Query',
          'RECEIVING > PROCESS_PALLHIST',
        );
        throw error;
      });
    if (recvo.ll_isConsCross) {
      await this.addUpdateConsCross(recvo.lc_pal, recvo.lcConscode);
    }

    if (await this.CheckForStackable(recvo.lc_batch, recvo.lc_pal)) {
      recvo.curOper = ReceivingState.MARK_PROCESS_GET_MOD;
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
      result = recvo.curOper;
      return result;
    }

    if (recvo.allowReceiverPutAway) {
      recvo.pcPutAway = 'N';
      recvo.curOper = ReceivingState.MARK_PROCESS_PUT_AWAY;
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
      result = recvo.curOper;
      return result;
    }

    await this.processLastPallet(fwho, recvo, constant);
    result = recvo.curOper;
    return result;
  }

  async processPallHistQuickRec(
    fwho: string,
    recVO: ReceivingVO,
  ): Promise<string> {
    const recvo = recVO;
    let result = '';
    const PALLHIST = `INSERT INTO PALLHIST (fworktype, fpalletid, flocfrom, flocto, foperid, fdatestamp, fequipid, fhandpal, fhandloc, fcustcode, fqty, fbatch)
      VALUES (
        'RECEIVE',
        '${recvo.lc_pal}',
        'WALK',
        '${recvo.llQuickrcv ? 'UNASSIGNEQ' : 'UNASSIGNED'}',
        '${fwho}',
        '${this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS')}',
        '',
        'false',
        'false',
        '${recvo.LOADIN.fcustcode}',
        '${Number.isNaN(recvo.lc_qty) ? 0 : Number(recvo.lc_qty)}',
        '${recvo.LOADIN.fbatch}'
    )`;
    const palHistlmsQuery = `
      ${PALLHIST};
      DECLARE @lmsId int;
      SELECT TOP 1 @lmsId = id from LMSCAN where palletid = '${
        recvo.lc_pal
      }' order by palletid;
      IF @lmsId IS NULL
        BEGIN
          INSERT INTO LMSCAN (operatorid, palletid, firstloc, origloc, machserial, roomloc, active, assignment, droploc, stage, worktype, iscomplete, datetime)
          VALUES (
            '${fwho}',
            '${recvo.lc_pal}',
            '',
            'WALK',
            '',
            '',
            'false',
            'false',
            '',
            '',
            'RECEIVE',
            'N',
            '${this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS')}'
          )
        END`;
    await this.manager()
      .query(palHistlmsQuery)
      .catch(error => {
        this.logger.error(
          { fpalletid: recvo.lc_pal },
          'Error in PALHIST/LMSCAN Query',
          'RECEIVING > PROCESS_PALLHIST_QUICKRCV',
        );
        throw error;
      });

    if (recvo.ll_isConsCross) {
      await this.addUpdateConsCross(recvo.lc_pal, recvo.lcConscode);
    }

    result = recvo.curOper;
    return result;
  }

  async GetModPallet(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    recvo.curOper = ReceivingState.MARK_PROCESS_GET_MOD;
    if (body.snkPal && body.snkPal.trim().toUpperCase() === 'Y') {
      recvo.curOper = ReceivingState.MARK_PROCESS_MOD_PAL;
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else if (body.snkPal && body.snkPal.trim().toUpperCase() === 'N') {
      if (recvo.allowReceiverPutAway) {
        recvo.pcPutAway = 'N';
        recvo.curOper = ReceivingState.MARK_PROCESS_PUT_AWAY;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
      } else {
        return this.processLastPallet(fwho, recvo, constant);
      }
    } else {
      errMsg = constant.BLAST_MUST_YN;
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processGetModPallet(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let warnMsg = '';
    let modPID = '';
    if (body.modPID && body.modPID.length > 0) {
      modPID = body.modPID.trim();
    }

    /*** Mask Definition Validation ****/
    let errMsg = '';
    recvo.curOper = ReceivingState.MARK_PROCESS_MOD_PAL;
    const maskResult = new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );

    const maskDefValid = await this.validateMaskDefinitionService.palletMaskDefinition<
      PostResponseReceivingDTO,
      ReceivingVO
    >(
      maskResult,
      recvo.LOADIN.fcustcode,
      modPID,
      MaskingTypeEnum.PALLETID,
      recvo,
      ModuleNameEnum.RECEIVE,
    );
    if (maskDefValid) {
      return maskDefValid;
    }

    const result = await this.storedProceduresNewService.getMarkmodpids({
      inBatch: recvo.lc_batch,
      inModpid: modPID,
      inPid: recvo.lc_pal,
      inRectypecheck: 0,
      outMessage: ''.padStart(100, ' '),
    });
    if (result && result.output && result.output.out_message) {
      if (result.output.out_message.toUpperCase().trim() === 'PASS') {
        warnMsg = '';
        if (recvo.allowReceiverPutAway) {
          recvo.pcPutAway = 'N';
          recvo.curOper = ReceivingState.MARK_PROCESS_PUT_AWAY;
          await this.cacheService.setcache(fwho, RECEIVING, recvo);
        } else {
          return this.processLastPallet(fwho, recvo, constant);
        }
      } else {
        warnMsg = result.output.out_message.trim();
        recvo.curOper = ReceivingState.MARK_PROCESS_GET_MOD;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
      }
    } else {
      warnMsg = constant.MODPID_NOT_EXIST;
      recvo.curOper = ReceivingState.MARK_PROCESS_GET_MOD;
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg: '',
        infoMsg: '',
        warnMsg,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async processLastPallet(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const scrnUI = [];
    if (recvo.plDynamicRail) {
      const PHYMSTres = await this.manager().query(
        `BEGIN SELECT TOP 1 id, TRIM(ftrack) ftrack, TRIM(fserial) fserial FROM dbo.PHY_MST WHERE fpalletid = '${recvo.lc_pal}' order by fpalletid ASC ; END`,
      );
      const PHY_MST: PhyMst = PHYMSTres[0];
      if (PHY_MST) {
        await this.RFDynamicSlottingApi(PHY_MST.ftrack, PHY_MST.fserial);
        await this.storedProceduresNewService.getDynamicwarehousepostreceivework(
          {
            inBatch: '',
            inIsrftype: recvo.pcGetLocType,
            inSerial: PHY_MST.fserial,
            inTrack: PHY_MST.ftrack,
            outNewloc: '',
          },
        );
      }
    }

    const LOADINresult = await this.manager().query(
      `BEGIN SELECT TOP 1 id, trim(fscanstat) fscanstat FROM dbo.Loadin WHERE fbatch = '${recvo.lc_batch}' order by fbatch ASC ; END`,
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
      if (!recvo.llQuickrcv) {
        recvo.lc_pal = '';
      } else if (recvo.QuickReciverDone) {
        recvo.lc_pal = '';
        recvo.QuickReciverDone = false;
      }
    }
    await this.cacheService.setcache(fwho, RECEIVING, recvo);

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      recvo.curOper === ReceivingState.MARK_PROCESS_PALLET
        && recvo.lineageFreightManagement && ['L', 'D', 'S'].includes(recvo.quickRec?.fquickrcv?.trim())
        ? `${constant.F5_EXIT}`
        : `${constant.F5_EXIT}~${constant.F8_LABL}`,
    );
  }

  async processPutAway(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let infoMsg = '';
    let errMsg = '';
    if (body.putAway && body.putAway.trim().toUpperCase() === 'Y') {
      recvo.putAway = 'Y';
      // DO TBLUPD WITH "PHY_MST"
      // DO DirectedPutaway WITH.T., .F.
      infoMsg = 'DirectedPutaway';
      await this.processLastPallet(fwho, recvo, constant);
    } else if (body.putAway && body.putAway.trim().toUpperCase() === 'N') {
      return this.processLastPallet(fwho, recvo, constant);
    } else {
      errMsg = constant.BLAST_MUST_YN;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg,
        curOper: recvo.curOper,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async INBDEL(recvo: ReceivingVO): Promise<void> {
    try {
      await this.facilityService.getConnection().query(`BEGIN
Declare @in_FBATCH char(7)
SET @in_FBATCH = '${recvo.lc_batch}'
DECLARE @BatchSize INT = 1000;
  BEGIN
      SET NOCOUNT ON;

      IF EXISTS
         (  SELECT   1
            FROM  [dbo].[LOADIN]
            WHERE [FBATCH]     = @in_FBATCH )
         BEGIN
            INSERT INTO [dbo].[RFEXPINV]
               ( [FADJUSTBY],
                 [FBATCH],
                 [FBBCODEDTE],
                 [FBBJULDTE],
                 [FBDATE],
                 [FBILLCUST],
                 [FBILLHIN],
                 [FBILLHOUT],
                 [FBILLINIT],
                 [FBREAKCODE],
                 [FBREAKFACT],
                 [FBRIX],
                 [FC_CUBE],
                 [FC_GROSWGT],
                 [FC_NETWGT],
                 [FC_PAL],
                 [FC_QTY],
                 [FCLASS],
                 [FCODEDTE],
                 [FCOMMITBY],
                 [FCUBE],
                 [FCUSTCODE],
                 [FCUSTLOT],
                 [FDAMAGE],
                 [FDATESTAMP],
                 [FEDILINE],
                 [FFINALBILL],
                 [FGROSSWGT],
                 [FHOLD],
                 [FISTRANS],
                 [FJULIANDTE],
                 [FLASTBILL],
                 [FLOT],
                 [FLOTPO],
                 [FLOTREF],
                 [FNETWGT],
                 [FNOTE],
                 [FO_CUBE],
                 [FO_GROSWGT],
                 [FO_NETWGT],
                 [FO_PAL],
                 [FO_QTY],
                 [FOVER],
                 [FOVERRIDE],
                 [FOWNER],
                 [FPACKTYPE],
                 [FPAL],
                 [FPICKZONE1],
                 [FPICKZONE2],
                 [FPRICECODE],
                 [FPRODGROUP],
                 [FPRODUCT],
                 [FQTY],
                 [FQTYPERPAL],
                 [FRATIO],
                 [FRECTYPE],
                 [FSEQUENCE],
                 [FSHIPDATE],
                 [FSHIPSTAT],
                 [FSHORT],
                 [FSORTDATE],
                 [FSTATUS],
                 [FSUPLRPROD],
                 [FSUPPLYNUM],
                 [FTEMPOVER],
                 [FTEMPPOST],
                 [FTIMESTAMP],
                 [FTRACK2],
                 [FTRANCUST],
                 [FUSDANUM],
                 [FVENDOVRD],
                 [FWHO] )
            SELECT
               [FADJUSTBY],
               [FBATCH],
               [FBBCODEDTE],
               [FBBJULDTE],
               [FBDATE],
               [FBILLCUST],
               [FBILLHIN],
               [FBILLHOUT],
               [FBILLINIT],
               [FBREAKCODE],
               [FBREAKFACT],
               [FBRIX],
               [FC_CUBE],
               [FC_GROSWGT],
               [FC_NETWGT],
               [FC_PAL],
               [FC_QTY],
               [FCLASS],
               [FCODEDTE],
               [FCOMMITBY],
               [FCUBE],
               [FCUSTCODE],
               [FCUSTLOT],
               [FDAMAGE],
               [FDATESTAMP],
               [FEDILINE],
               [FFINALBILL],
               [FGROSSWGT],
               [FHOLD],
               [FISTRANS],
               [FJULIANDTE],
               [FLASTBILL],
               [FLOT],
               [FLOTPO],
               [FLOTREF],
               [FNETWGT],
               [FNOTE],
               [FO_CUBE],
               [FO_GROSWGT],
               [FO_NETWGT],
               [FO_PAL],
               [FO_QTY],
               [FOVER],
               [FOVERRIDE],
               [FOWNER],
               [FPACKTYPE],
               [FPAL],
               [FPICKZONE1],
               [FPICKZONE2],
               [FPRICECODE],
               [FPRODGROUP],
               [FPRODUCT],
               [FQTY],
               [FQTYPERPAL],
               [FRATIO],
               'E',  -- FRECTYPE
               [FSEQUENCE],
               [FSHIPDATE],
               [FSHIPSTAT],
               [FSHORT],
               [FSORTDATE],
               (  SELECT   TOP ( 1 )
                           [FSTATUS]
                  FROM  [dbo].[PHY_MST]
                  WHERE NOT [FSTATUS] = ''
                    AND [FTRACK] = [INV_MST].[BATCHSEQ] ),
               [FSUPLRPROD],
               [FSUPPLYNUM],
               [FTEMPOVER],
               [FTEMPPOST],
               [FTIMESTAMP],
               [FTRACK2],
               [FTRANCUST],
               [FUSDANUM],
               [FVENDOVRD],
               [FWHO]
            FROM  [dbo].[INV_MST]
            WHERE [FBATCH] = @in_FBATCH;
            
            DELETE FROM ATTRIBUTES_DATA_PHY_DET
            WHERE ENTITY_ID IN (
                SELECT ID
                FROM PHY_DET
                WHERE FBATCH = @in_FBATCH
            );

            DELETE FROM ATTRIBUTES_DATA_PHY_MST
            WHERE ENTITY_ID IN (
                SELECT ID
                FROM PHY_MST
                WHERE FTRACK LIKE CONCAT(@in_FBATCH, '___')
            );

            DELETE FROM ATTRIBUTES_DATA_INV_MST
            WHERE ENTITY_ID IN (
                SELECT ID
                FROM INV_MST
                WHERE FBATCH = @in_FBATCH
            );

            DELETE FROM [dbo].[PHY_DET]
            WHERE [FBATCH] = @in_FBATCH;

            -- Batched delete for PHY_MST
            WHILE (1 = 1)
            BEGIN
              DELETE TOP (@BatchSize) FROM [dbo].[PHY_MST]
              WHERE [FTRACK] IN (
                SELECT [FTRACK]
                FROM [dbo].[PHY_MST] WITH (FORCESEEK)
                WHERE [FTRACK] LIKE CONCAT(@in_FBATCH, '___')
              );

              IF @@ROWCOUNT < @BatchSize
                BREAK;
            END

            DELETE FROM [dbo].[PHY_TRN]
            WHERE [FBATCH] = @in_FBATCH;

            DELETE FROM [dbo].[INV_TRN]
            WHERE [FBATCH] = @in_FBATCH;

            DELETE FROM [dbo].[INV_MST]
            WHERE [FBATCH] = @in_FBATCH;
         END;
   END;
END;
`);
    } catch (error) {
      this.logger.error(
        { error, message: 'INBDEL -->' },
        'Error in INBDEL',
        ReceivingService.name,
      );
    }
    // await this.facilityService.getConnection().query('EXEC usp_inbounds_INBDEL_RF @0', [recvo.lc_batch]);
  }

  async USEDF6COPY(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    recvo.lc_prod = recvo.lc_oldprod;
    recvo.lc_dte = recvo.lc_olddte;
    recvo.lc_isblast = recvo.lc_oldisblast;
    recvo.lc_isHPP = recvo.lc_oldisHPP;
    recvo.lc_lot = recvo.lc_oldlot;
    recvo.lc_clot = recvo.lc_oldclot;
    recvo.lc_estb = recvo.lc_oldestb;
    recvo.lc_slaughdte = recvo.lc_oldslaughdte;
    recvo.lc_ref = recvo.lc_oldref;
    recvo.lc_temp = recvo.lc_oldtemp;
    recvo.lc_dtetyp = recvo.lc_olddtetyp;
    recvo.ll_iscatch = recvo.ll_oldcatch;
    recvo.lc_acwt = recvo.lc_oldacwt;
    recvo.ln_blasthrs = recvo.ln_oldblasthrs;
    recvo.ln_intie = recvo.ln_oldtie;
    recvo.ln_high = recvo.ln_oldhigh;
    recvo.lc_bbdte = recvo.lc_oldbbdte;

    const PHYMSTres = await this.manager().query(
      `BEGIN SELECT TOP 1 id, TRIM(fpalletid) fpalletid, fisblast, fblasthrs, fishpp, TRIM(ftrack) ftrack, TRIM(fserial) fserial, TRIM(fcustcode) fcustcode, TRIM(fhold) fhold, TRIM(fcustcode) fcustcode
        FROM dbo.PHY_MST WHERE fpalletid = '${recvo.lc_pal}' order by fpalletid ASC ; END`,
    );
    const PHY_MST = PHYMSTres[0];
    if (PHY_MST) {
      PHY_MST.fisblast = recvo.lc_isblast === 'N';
      PHY_MST.fblasthrs = recvo.lc_isblast !== 'N' ? 0 : recvo.ln_blasthrs; // TRM 03 / 03 / 2003 Ticket 4364
      PHY_MST.fishpp = recvo.lc_isHPP !== 'N';

      let plUseStackHold = false;
      const [result] = await this.facilityService
        .getConnection()
        .createEntityManager()
        .query(
          `SELECT plUseStackHold = CASE WHEN EXISTS(SELECT 1 FROM DBO.CUSTSET WHERE FCUSTCODE = '${PHY_MST.fcustcode}' AND USESTACKHOLD = 1) THEN 1 ELSE 0 END;`,
        );
      if (result && result.plUseStackHold && result.plUseStackHold === true) {
        plUseStackHold = true;
      }

      PHY_MST.fishpp = recvo.lc_isHPP !== 'N';
      if (plUseStackHold && recvo.lc_isHPP !== 'N') {
        await this.storedProceduresNewService.getWcsStackholdscreationandrelease(
          {
            holdcode: 'HPP',
            holdenteredby: fwho,
            holdorrelease: 'H',
            newholdcomment: '',
            newstatus: '',
            oneside: '',
            palletorlot: 'P',
            releasecomment: '',
            serial: PHY_MST.fserial,
            track: PHY_MST.ftrack,
          },
        );
      } else {
        PHY_MST.fhold = recvo.lc_isHPP === 'N' ? 'NONE' : 'HPP';
      }
      const phyMstUpdateQry = `UPDATE PHY_MST SET fisblast = '${PHY_MST.fisblast}', fblasthrs = '${PHY_MST.fblasthrs}'
        fishpp = '${PHY_MST.fishpp}', fhold = '${PHY_MST.fhold}' WHERE ID = '${PHY_MST.id}'`;
      await this.manager().query(phyMstUpdateQry);
      // await this.phymstRepo().save(PHY_MST);
    }

    recvo.curOper = ReceivingState.MARK_PROCESS_DATE;
    await this.cacheService.setcache(fwho, RECEIVING, recvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: recvo.curOper,
      }),
      getOutputFields(recvo.lc_dtetyp !== 'J' ? 'codeDate' : 'julinDate'),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async QUICKOUT(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
    warnMsg1: string,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const startTime = moment();
    this.logger.debug(
      {
        fwho,
        startTime: `${moment().format('HH:mm:ss-SSS')}`,
        lc_pal: recvo.lc_pal,
        foutbatch: recvo.LOADIN.foutbatch,
      },
      `QUICKOUT > BEGIN with ${recvo.curOper}`,
    );
    let errMsg = '';
    let warnMsg = warnMsg1.trim() ? warnMsg1 : '';
    const result = ['D', 'B', 'W'].includes(
      recvo.lc_pal.toUpperCase().charAt(0),
    );
    const fdatestamp = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
    const ftimestamp = this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');
    if (!result) {
      const LOADOUTQUERY = `SELECT TOP 1 CONVERT(varchar, fbdate, 23) as LFBDATE, ID, FBATCH, FCUSTCODE,FMBOL,FDOOR,FDROPNUM FROM LOADOUT WHERE FBATCH = @0 ORDER BY FBATCH ASC;`;
      const LOADOUT = await this.manager()
        .query(`BEGIN ${LOADOUTQUERY} END;`, [recvo.LOADIN.foutbatch])
        .catch(error => {
          this.logger.error(
            { fbatch: recvo.LOADIN.foutbatch },
            'Error in LOADOUT FETCH Query',
            'RECEIVING > PROCESS_QUICKOUT',
          );
          throw error;
        });
      if (LOADOUT && LOADOUT.length > 0) {
        this.logger.debug({ LOADOUT }, 'QUICKOUT > LOADOUT length > 0');
        const PHY_MSTQUERY = `SELECT TOP 1 ID,FHOLD,FTRACK,FQTY,FSERIAL,FPAL,FLOCATION,FSTATUS,FPALLETID FROM PHY_MST WHERE FPALLETID = @0 ORDER BY FPALLETID ASC;`;
        const PHY_MST = await this.manager()
          .query(`BEGIN ${PHY_MSTQUERY} END;`, [recvo.lc_pal])
          .catch(error => {
            this.logger.error(
              { fpalletid: recvo.lc_pal },
              'Error in PHY_MST FETCH Query',
              'RECEIVING > PROCESS_QUICKOUT',
            );
            throw error;
          });
        if (PHY_MST && PHY_MST.length > 0) {
          this.logger.debug({ PHY_MST }, 'QUICKOUT > PHY_MST length > 0');

          const invMstCode2Query = `
            DECLARE @INVMSTID int,@FBATCH char(7), @IFLASTBILL varchar(30), @FCUSTCODE char(10), @FPRODGROUP char(5), @FPRODUCT char(16), @FOWNER char(10), @FSUPLRPROD char(16), @FHOLD varchar(20), @FSEQUENCE char(3), @FLOT char(16), @FTRACK2 char(10),
            @FPICKCODE char(5), @FPICKDAYS numeric(3,0), @FCATCHWGT char(1), @CODE2ID int;
            SELECT TOP 1 @INVMSTID = id,@FBATCH = FBATCH, @IFLASTBILL = CONVERT(varchar, FLASTBILL, 23),@FCUSTCODE = FCUSTCODE, @FPRODGROUP = FPRODGROUP, @FPRODUCT = FPRODUCT, @FOWNER = FOWNER,
            @FSUPLRPROD = FSUPLRPROD, @FHOLD = FHOLD, @FSEQUENCE = FSEQUENCE, @FLOT = FLOT, @FTRACK2 = FTRACK2 FROM INV_MST WHERE BatchSeq = '${PHY_MST[0].FTRACK}' ORDER BY BatchSeq DESC;

            IF @INVMSTID IS NOT NULL
              BEGIN
                IF @FSEQUENCE = '001'
                  BEGIN
                    UPDATE LOADOUT SET FSALESORD = @FLOT WHERE id='${LOADOUT[0].ID}';
                  END
                SELECT TOP 1 @CODE2ID = id, @FPICKCODE = FPICKCODE, @FPICKDAYS = FPICKDAYS, @FCATCHWGT = FCATCHWGT FROM CODE2 WHERE
                  FCUSTCODE = @FCUSTCODE AND FPRODGROUP = @FPRODGROUP  AND FPRODUCT = @FPRODUCT AND FOWNER = @FOWNER AND FSUPLRPROD = @FSUPLRPROD ORDER BY FCUSTCODE+FPRODGROUP+FPRODUCT+FOWNER+FSUPLRPROD ASC;
              END

            SELECT @INVMSTID INVMSTID,@FBATCH FBATCH,@IFLASTBILL IFLASTBILL,@FCUSTCODE FCUSTCODE,@FPRODGROUP FPRODGROUP,@FPRODUCT FPRODUCT,@FOWNER FOWNER,@FSUPLRPROD FSUPLRPROD,@FHOLD FHOLD,@FSEQUENCE FSEQUENCE,
            @FLOT FLOT,@FTRACK2 FTRACK2,@FPICKCODE FPICKCODE,@FPICKDAYS FPICKDAYS,@FCATCHWGT FCATCHWGT,@CODE2ID CODE2ID;
          `;
          let INV_MST: string | any[] = [];
          let CODE2: string | any[] = [];
          const [invMstCode2Res] = await this.manager()
            .query(invMstCode2Query)
            .catch(error => {
              this.logger.error(
                { BatchSeq: PHY_MST[0].FTRACK, loadoutId: LOADOUT[0].ID },
                'Error in INVMST/CODE2 FETCH Query',
                'RECEIVING > PROCESS_QUICKOUT',
              );
              throw error;
            });
          if (invMstCode2Res && invMstCode2Res?.INVMSTID) {
            INV_MST = [
              lodash.pick(invMstCode2Res, [
                'FBATCH',
                'IFLASTBILL',
                'FCUSTCODE',
                'FPRODGROUP',
                'FPRODUCT',
                'FOWNER',
                'FSUPLRPROD',
                'FHOLD',
                'FSEQUENCE',
                'FLOT',
                'FTRACK2',
              ]),
            ];
          }
          if (invMstCode2Res && invMstCode2Res?.CODE2ID) {
            CODE2 = [
              lodash.pick(invMstCode2Res, [
                'FPICKCODE',
                'FPICKDAYS',
                'FCATCHWGT',
              ]),
            ];
          }

          if (INV_MST && INV_MST.length > 0) {
            this.logger.debug({ INV_MST }, 'QUICKOUT > INV_MST length > 0');
            this.logger.debug({ CODE2 }, 'QUICKOUT > CODE2');
            if (
              (INV_MST[0].FHOLD.trim() === 'NONE' ||
                INV_MST[0].FHOLD.trim() === '') &&
              (PHY_MST[0].FHOLD.trim() === 'NONE' ||
                PHY_MST[0].FHOLD.trim() === '')
            ) {
              this.logger.debug(
                { FHOLD: INV_MST[0].FHOLD },
                'QUICKOUT > FHOLD',
              );
              const invTrnQry = `
              DECLARE @INVTRNID int, @FBATCH char(7), @FSEQUENCE char(3), @FTRACK char(10), @FCUSTCODE char(10), @FRECTYPE char(1), @newSeq char(3);
              SELECT TOP 1 @INVTRNID = id, @FBATCH = FBATCH, @FSEQUENCE = FSEQUENCE, @FTRACK = FTRACK, @FCUSTCODE = FCUSTCODE, @FRECTYPE = FRECTYPE FROM INV_TRN WHERE FBATCH = '${recvo.LOADIN.foutbatch}' AND FTRACK = '${PHY_MST[0].FTRACK}' ORDER BY FBATCH+FTRACK ASC;
              IF @INVTRNID IS NULL
                BEGIN
                  DECLARE @prevSeq char(3);
                  SELECT TOP 1 @prevSeq = FSEQUENCE FROM INV_TRN WHERE FBATCH = '${recvo.LOADIN.foutbatch}' ORDER BY FBATCH+FSEQUENCE DESC;
                  IF @prevSeq IS NULL
                    SET @newSeq = '001';
                  ELSE
                    SET @newSeq = Format((@prevSeq+1), '000');
                    INSERT into INV_TRN ( fbatch,fsequence,fcustcode,fbdate,ftrack,ftrack2 ,frectype,fprodgroup,fproduct, fowner,fsuplrprod,fcomittype,fqty,flastbill,fwho,fdatestamp,ftimestamp)
                      VALUES (
                        '${LOADOUT[0].FBATCH}',
                        @newSeq,
                        '${LOADOUT[0].FCUSTCODE}',
                        '${LOADOUT[0].LFBDATE}',
                        '${INV_MST[0].FBATCH}${INV_MST[0].FSEQUENCE}',
                        '${INV_MST[0].FTRACK2}',
                        'C',
                        '${INV_MST[0].FPRODGROUP}',
                        '${INV_MST[0].FPRODUCT}',
                        '${INV_MST[0].FOWNER}',
                        '${INV_MST[0].FSUPLRPROD}',
                        'G',
                        '${PHY_MST[0].FQTY}',
                        '${INV_MST[0].IFLASTBILL}',
                        '${fwho}',
                        '${fdatestamp}',
                        '${ftimestamp}'
                      );
                END
              SELECT @INVTRNID id, @FBATCH FBATCH, @FSEQUENCE FSEQUENCE, @FTRACK FTRACK, @FCUSTCODE FCUSTCODE, @FRECTYPE FRECTYPE, @newSeq rfcQuickseq;
              `;
              const [invTrnRes] = await this.manager()
                .query(invTrnQry)
                .catch(error => {
                  this.logger.error(
                    {
                      fbatch: recvo.LOADIN.foutbatch,
                      ftrack: PHY_MST[0].FTRACK,
                      lfbDate: LOADOUT[0].LFBDATE,
                      fseq: INV_MST[0].FSEQUENCE,
                    },
                    'Error in INV_TRN INSERT Query',
                    'RECEIVING > PROCESS_QUICKOUT',
                  );
                  throw error;
                });
              let INV_TRN;
              let rfcQuickseq;
              if (invTrnRes && invTrnRes?.id) {
                INV_TRN = [invTrnRes];
              } else {
                rfcQuickseq = invTrnRes?.rfcQuickseq || '';
              }
              this.logger.debug({ INV_TRN }, 'QUICKOUT > INV_TRN');
              const invTrnFbatch =
                INV_TRN && INV_TRN.length > 0
                  ? INV_TRN[0].FBATCH
                  : LOADOUT[0].FBATCH;
              const invTrnSeq =
                INV_TRN && INV_TRN.length > 0
                  ? INV_TRN[0].FSEQUENCE
                  : rfcQuickseq;
              const invTrnTrack =
                INV_TRN && INV_TRN.length > 0
                  ? INV_TRN[0].FTRACK
                  : `${INV_MST[0].FBATCH}${INV_MST[0].FSEQUENCE}`;
              const PHYTRN = new PhyTrn();
              PHYTRN.fcustcode =
                INV_TRN && INV_TRN.length > 0
                  ? INV_TRN[0].FCUSTCODE
                  : LOADOUT[0].FCUSTCODE;
              PHYTRN.fbatch = invTrnFbatch;
              PHYTRN.fsequence = invTrnSeq;
              PHYTRN.ftrack = invTrnTrack;
              PHYTRN.fserial = PHY_MST[0].FSERIAL;
              PHYTRN.frectype =
                INV_TRN && INV_TRN.length > 0 ? INV_TRN[0].FRECTYPE : 'C';
              PHYTRN.fqty = PHY_MST[0].FQTY;
              PHYTRN.fpal = PHY_MST[0].FPAL;
              PHYTRN.flocation = PHY_MST[0].FLOCATION;
              PHYTRN.fpickcode = CODE2[0].FPICKCODE;
              PHYTRN.fdelvshelf = CODE2[0].FPICKDAYS;
              PHYTRN.fstatus = PHY_MST[0].FSTATUS;
              PHYTRN.fwho = fwho;
              PHYTRN.fdatestamp = new Date(fdatestamp);
              PHYTRN.ftimestamp = ftimestamp;
              PHYTRN.fscandate = new Date(fdatestamp);
              PHYTRN.fscantime = ftimestamp;
              PHYTRN.fscanwho = fwho;
              PHYTRN.fscnoutsta = 'S';

              const updateOrInsertPhyTrn = `
              DECLARE @PHYTRNID int;
              SELECT TOP 1 @PHYTRNID = id from PHY_TRN WHERE FBATCH = '${invTrnFbatch}' and FSEQUENCE = '${invTrnSeq}' and FTRACK = '${invTrnTrack}' and FSERIAL = '${PHY_MST[0].FSERIAL}' ORDER BY FBATCH+FSEQUENCE+FTRACK+FSERIAL ASC;
              IF @PHYTRNID IS NOT NULL
                BEGIN
                  UPDATE PHY_TRN SET  FQTY = ${PHY_MST[0].FQTY}, FPAL = ${PHY_MST[0].FPAL}, FWHO = '${fwho}', fdatestamp = '${fdatestamp}' , ftimestamp='${ftimestamp}' WHERE id = @PHYTRNID;
                END
              ELSE
                BEGIN
                  INSERT into PHY_TRN ( fcustcode, fbatch, fsequence, ftrack, fserial, frectype, fqty, fpal, flocation, fpickcode, fdelvshelf, fstatus, fwho, fdatestamp, ftimestamp, fscandate, fscantime, fscanwho, fscnoutsta)
                      VALUES
                        (
                          '${PHYTRN.fcustcode}' ,
                          '${PHYTRN.fbatch}',
                          '${PHYTRN.fsequence}' ,
                          '${PHYTRN.ftrack}',
                          '${PHYTRN.fserial}' ,
                          '${PHYTRN.frectype}',
                          '${PHYTRN.fqty}',
                          '${PHYTRN.fpal}',
                          '${PHYTRN.flocation}',
                          '${PHYTRN.fpickcode}',
                          '${PHYTRN.fdelvshelf}',
                          '${PHYTRN.fstatus}',
                          '${fwho}',
                          '${fdatestamp}',
                          '${PHYTRN.ftimestamp}',
                          '${fdatestamp}',
                          '${ftimestamp}',
                          '${fwho}',
                          'S'
                        );
                END
              `;
              await this.manager()
                .query(updateOrInsertPhyTrn)
                .catch(error => {
                  this.logger.error(
                    {
                      fbatch: invTrnFbatch,
                      ftrack: invTrnTrack,
                      fserial: PHY_MST[0].FSERIAL,
                      fseq: invTrnSeq,
                    },
                    'Error in PHYTRN INSERT/UPDATE Query',
                    'RECEIVING > PROCESS_QUICKOUT',
                  );
                  throw error;
                });
              const flocation = `DR${recvo.LOADIN.fdoornum
                .toString()
                .slice(0, 3)
                .trim()
                .padStart(3, '0')}`;

              const updateOrInsertStage = `
              DECLARE @STAGEID int, @FLOADDATE datetime2;
              SELECT TOP 1 @STAGEID = id FROM STAGE WHERE FCUBEDID = '${PHY_MST[0].FPALLETID}' ORDER BY FCUBEDID;

              IF @STAGEID IS NOT NULL
                BEGIN
                  UPDATE STAGE SET FBATCH = '${LOADOUT[0].FBATCH}', FMBOL = '${LOADOUT[0].FMBOL}', FLOCATION = '${flocation}',
                   FDOOR = '${LOADOUT[0].FDOOR}' , FDROPNUM = '${LOADOUT[0].FDROPNUM}', FPRODUCT = '${INV_MST[0].FPRODUCT}', FQTY = '${PHY_MST[0].FQTY}', FSEQUENCE = '${invTrnSeq}',
                   FTRACK = '${invTrnTrack}' , FSERIAL = '${PHY_MST[0].FSERIAL}', FTODOOR = 'Y' WHERE id = @STAGEID;
                END
              ELSE
                BEGIN
                  INSERT into STAGE (fbatch, fmbol, fcubedid, flocation, fdoor, fdropnum, fproduct, fqty, fsequence, ftrack, fserial, ftodoor, fplandate)
                    VALUES (
                      '${LOADOUT[0].FBATCH}',
                      '${LOADOUT[0].FMBOL}',
                      '${PHY_MST[0].FPALLETID}',
                      '${flocation}',
                      '${LOADOUT[0].FDOOR}',
                      '${LOADOUT[0].FDROPNUM}',
                      '${INV_MST[0].FPRODUCT}',
                      '${PHY_MST[0].FQTY}',
                      '${invTrnSeq}',
                      '${invTrnTrack}',
                      '${PHY_MST[0].FSERIAL}',
                      'Y',
                      '${fdatestamp}'
                    );
                END
              SELECT @FLOADDATE as FLOADDATE;
              `;
              const [updateOrInsertStageRes] = await this.manager()
                .query(updateOrInsertStage)
                .catch(error => {
                  this.logger.error(
                    {
                      FCUBEDID: PHY_MST[0].FPALLETID,
                      ftrack: invTrnTrack,
                      fserial: PHY_MST[0].FSERIAL,
                      fseq: invTrnSeq,
                    },
                    'Error in STAGE INSERT/UPDATE Query',
                    'RECEIVING > PROCESS_QUICKOUT',
                  );
                  throw error;
                });
              const stageFloadDate =
                updateOrInsertStageRes && updateOrInsertStageRes.FLOADDATE
                  ? updateOrInsertStageRes.FLOADDATE
                  : '';

              if (CODE2 && CODE2.length > 0 && CODE2[0].FCATCHWGT === 'B') {
                await this.manager()
                  .query(`INSERT INTO PHY_DET (FCUSTCODE, FTRACK, FSERIAL, FRECTYPE, FBATCH, FSEQUENCE, FLOT, FNETWGT, FBOXSEQ, FWHO, FDATESTAMP, FTIMESTAMP, FTEMPPOST, FCODEDTE, FFULLLABEL)
                      SELECT FCUSTCODE, FTRACK, FSERIAL, 'C', '${LOADOUT[0].FBATCH}', '${invTrnSeq}', FLOT, FNETWGT, FBOXSEQ, '${fwho}', '${fdatestamp}' , '${ftimestamp}', FTEMPPOST, FCODEDTE, FFULLLABEL
                      FROM dbo.PHY_DET WHERE FTRACK='${PHY_MST[0].FTRACK}' AND FSERIAL='${PHY_MST[0].FSERIAL}'
                      AND FBATCH='${recvo.LOADIN.fbatch}';
                      IF EXISTS (SELECT 1 FROM PHY_TRN WHERE FBATCH='${recvo.LOADIN.fbatch}'
                      AND FTRACK='${PHY_MST[0].FTRACK}' AND FSERIAL='${PHY_MST[0].FSERIAL}' AND FSINGLEWGT=1)
                      BEGIN UPDATE PHY_TRN SET FSINGLEWGT=1 WHERE FBATCH='${LOADOUT[0].FBATCH}' AND FSEQUENCE='${invTrnSeq}'
                      AND FTRACK='${PHY_MST[0].FTRACK}' AND FSERIAL = '${PHY_MST[0].FSERIAL}' END `);
              }
              if (recvo.ln_fulpalchg !== 0) {
                const DOWNSTACK = new Downstack();
                DOWNSTACK.fcustcode =
                  INV_TRN && INV_TRN.length > 0
                    ? INV_TRN[0].FCUSTCODE
                    : LOADOUT[0].FCUSTCODE;
                DOWNSTACK.flot = INV_MST[0].FLOT;
                DOWNSTACK.fprodgroup = INV_MST[0].FPRODGROUP;
                DOWNSTACK.fproduct = INV_MST[0].FPRODUCT;
                DOWNSTACK.fowner = INV_MST[0].FOWNER;
                DOWNSTACK.fsuplrprod = INV_MST[0].FSUPLPROD;
                DOWNSTACK.forigcust =
                  INV_TRN && INV_TRN.length > 0
                    ? INV_TRN[0].FCUSTCODE
                    : LOADOUT[0].FCUSTCODE;
                DOWNSTACK.fqty = 1;
                DOWNSTACK.fbatch = invTrnFbatch;
                DOWNSTACK.fsequence = invTrnSeq;
                DOWNSTACK.ftrack = invTrnTrack;
                DOWNSTACK.fserial = PHY_MST[0].FSERIAL;
                DOWNSTACK.fpalletid = PHY_MST[0].FPALLETID;
                DOWNSTACK.fdebit = Number.parseFloat(
                  recvo.ln_fulpalchg.toFixed(2),
                );
                DOWNSTACK.forigamt = Number.parseFloat(
                  recvo.ln_fulpalchg.toFixed(2),
                );
                DOWNSTACK.fgl = recvo.lc_fulpalgl;
                DOWNSTACK.fbilltype = 'FC';
                DOWNSTACK.frate = recvo.ln_fulpalchg;
                DOWNSTACK.fwho = fwho;
                DOWNSTACK.fdatestamp = new Date(fdatestamp);
                const downStackQry = `DECLARE @DOWNSTACKID int;
                  SELECT TOP 1 @DOWNSTACKID = id from DOWNSTACK WHERE FBATCH = '${invTrnFbatch}' AND FSEQUENCE =  '${invTrnSeq}' AND FTRACK = '${invTrnTrack}' AND FSERIAL= '${PHY_MST[0].FSERIAL}' ORDER BY FBATCH+FSEQUENCE+FTRACK+FSERIAL ASC;
                  IF @DOWNSTACKID IS NULL
                    BEGIN
                      INSERT into DOWNSTACK (fcustcode, flot, fprodgroup, fproduct, fowner, fsuplrprod, forigcust, fqty, fbatch, fsequence, ftrack, fserial, fpalletid, fdebit, forigamt, fgl, fbilltype, frate, fwho, fdatestamp)
                       VALUES  (
                         '${DOWNSTACK.fcustcode}',
                         '${DOWNSTACK.flot}',
                         '${DOWNSTACK.fprodgroup}',
                         '${DOWNSTACK.fproduct}',
                         '${DOWNSTACK.fowner}',
                         '${DOWNSTACK.fsuplrprod}',
                         '${DOWNSTACK.forigcust}',
                         '${DOWNSTACK.fqty}',
                         '${DOWNSTACK.fbatch}',
                         '${DOWNSTACK.fsequence}',
                         '${DOWNSTACK.ftrack}',
                         '${DOWNSTACK.fserial}',
                         '${DOWNSTACK.fpalletid}',
                         '${DOWNSTACK.fdebit}',
                         '${DOWNSTACK.forigamt}',
                         '${DOWNSTACK.fgl}',
                         '${DOWNSTACK.fbilltype}',
                         '${DOWNSTACK.frate}',
                         '${DOWNSTACK.fwho}',
                         '${DOWNSTACK.fdatestamp}'
                        );
                      END
                `;
                await this.manager()
                  .query(downStackQry)
                  .catch(error => {
                    this.logger.error(
                      {
                        ln_fulpalchg: recvo.ln_fulpalchg,
                        ftrack: invTrnTrack,
                        fserial: PHY_MST[0].FSERIAL,
                        fseq: invTrnSeq,
                      },
                      'Error in DOWNSTACK INSERT Query',
                      'RECEIVING > PROCESS_QUICKOUT',
                    );
                    throw error;
                  });
                this.logger.debug(
                  { ln_fulpalchg: recvo.ln_fulpalchg, DOWNSTACK },
                  'QUICKOUT > recvo.ln_fulpalchg, DOWNSTACK',
                );
              }
              if (
                recvo.ll_intrucktotruck &&
                !stageFloadDate &&
                !recvo.ll_intruckstage
              ) {
                // NEED TO CHECK THIS
                // TODO - DO Loading.prg WITH lcInMachineID,lc_pal,.T.
                const phyMstLData = await this.manager().query(
                  `BEGIN select top 1 id,fhold,ftrack,fserial,fqty,fmergeid,fpalletid,fstatus,fcustcode,flocation from PHY_MST where FPALLETID = '${recvo.lc_pal}' order by fpalletid END;`,
                );

                const lcvo = new LoadingVO();
                if (phyMstLData && phyMstLData.length > 0) {
                  lcvo.PHYMST = phyMstLData[0];
                }
                // lcvo.PHYMST = phyMstL;
                lcvo.pcMachineID = recvo.lcInMachineID
                  ? recvo.lcInMachineID
                  : '';
                lcvo.lcPal = recvo.lc_pal;
                lcvo.tcTruck2Truck = true;
                lcvo.curOper = 'MARK_PROCESS_PALLET';
                lcvo.originator = 'RECEIVING-LOADING';
                recvo.QuickReciverDone = true;
                // recvo.lc_pal = '';
                await this.cacheService.set2Obj(
                  fwho,
                  RECEIVING,
                  recvo,
                  OBLOADING,
                  lcvo,
                );
                return new ResponseKeysDTO(
                  plainToClass(PostResponseReceivingDTO, {
                    errMsg: '',
                    infoMsg: 'LOADING',
                    curOper: recvo.curOper,
                    warnMsg,
                  }),
                  getOutFieldState(recvo.curOper),
                );
              }
            } else {
              warnMsg = warnMsg
                ? `${warnMsg}\n${constant.PALLET_ONHOLD}`
                : `${constant.PALLET_ONHOLD}`;
              this.logger.debug({ warnMsg }, 'QUICKOUT > warnMsg');
            }
            // }
          }
        }
      }
    } else {
      errMsg = constant.DAMAGED_PALLET;
    }
    // The code which was modified on processlastpallet is added here
    // recvo.lc_pal = '';
    recvo.QuickReciverDone = true;
    await this.cacheService.setcache(fwho, RECEIVING, recvo);
    this.logger.debug(
      {
        service: ReceivingService.name,
        curOper: recvo.curOper,
        fwho,
      },
      `receiving --> QUICKOUT | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')}`,
    );
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        warnMsg,
        infoMsg: '',
        curOper: recvo.curOper,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async OUTCLOSE(recvo: ReceivingVO): Promise<void> {
    // const LOADOUT = await this.loadoutRepo().findOne({
    //   fbatch: recvo.lcOutbatch,
    // });
    const startTime = moment();
    this.logger.debug(
      {
        startTime: `${moment().format('HH:mm:ss-SSS')}`,
        lc_batch: recvo.lc_batch,
        lcOutbatch: recvo.lcOutbatch,
      },
      `OUTCLOSE > BEGIN with ${recvo.curOper}`,
    );
    const LOADOUTQUERY = `SELECT TOP 1 ID, FBATCH FROM LOADOUT WHERE FBATCH = @0 ORDER BY FBATCH ASC;`;
    const LOADOUT = await this.manager().query(`BEGIN ${LOADOUTQUERY} END;`, [
      recvo.lcOutbatch,
    ]);

    if (LOADOUT && LOADOUT.length > 0) {
      this.logger.debug({ LOADOUT }, 'OUTCLOSE > LOADOUT length > 0');
      const INV_TRNQUERY = `SELECT FBATCH, FSEQUENCE, FTRACK, FGROSSWGT, FQTY, ID FROM INV_TRN WHERE FBATCH = @0 ORDER BY FBATCH + FSEQUENCE ASC;`;
      const INVTRN = await this.manager()
        .query(`BEGIN ${INV_TRNQUERY} END;`, [recvo.lcOutbatch])
        .catch(error => {
          this.logger.error(
            { fbatch: recvo.lcOutbatch },
            'Error in INVTRN FETCH Query',
            'RECEIVING > PROCESS_OUTCLOSE',
          );
          throw error;
        });
      // const PHY_MST_ARR = await this.manager()
      //   .query(`BEGIN SELECT id, TRIM(ftrack) ftrack, TRIM(fserial) fserial, fqty, fishpp, fpal, FO_PAL as foPal, FO_QTY as foQty,
      //   TRIM(fcustcode) fcustcode, TRIM(fcustpalid) fcustpalid, TRIM(fpalletid) fpalletid, TRIM(fhold) fhold, fishpp
      //   FROM PHY_MST WHERE FTRACK LIKE '${recvo.lc_batch}%' ORDER BY FTRACK+FSERIAL ASC; END`);
      const PhytrnQUERY = `SELECT ID, FBATCH, FSEQUENCE, FTRACK, FSERIAL, FQTY FROM PHY_TRN WHERE FBATCH = @0 ORDER BY FBATCH+FSEQUENCE+FTRACK+FSERIAL ASC;`;
      const PHY_TRN_ARR = await this.manager()
        .query(`BEGIN ${PhytrnQUERY} END;`, [recvo.lcOutbatch])
        .catch(error => {
          this.logger.error(
            { fbatch: recvo.lcOutbatch },
            'Error in PHYTRN FETCH Query',
            'RECEIVING > PROCESS_OUTCLOSE',
          );
          throw error;
        });
      // const INV_MST = await this.manager().query(
      //   `BEGIN SELECT * FROM INV_MST WHERE FBATCH = '${recvo.lc_batch}' ORDER BY FBATCH+FSEQUENCE ASC; END`,
      // );
      let lnQcount = 0;
      let lnWcount = 0;
      let delInvTrnIds = '';
      this.logger.debug(
        { INVTRN, PHY_TRN_ARR },
        'OUTCLOSE > INVTRN, PHY_TRN_ARR',
      );
      // eslint-disable-next-line no-restricted-syntax
      for (const INV_TRN of INVTRN) {
        // if (INV_TRN && INV_TRN.FBATCH === recvo.lcOutbatch) {
        // const PhyTrnQuery = `SELECT * FROM PHY_TRN WHERE FBATCH = @0
        //             AND FSEQUENCE = @1 AND FTRACK = @2
        //             ORDER BY FBATCH+FSEQUENCE+FTRACK+FSERIAL ASC;`;
        // const  PHYTRN =  await this.manager().query(`BEGIN ${PhyTrnQuery} END;`, [INV_TRN.FBATCH, INV_TRN.FSEQUENCE, INV_TRN.FTRACK ]);
        const PHY_TRN: any[] = [];
        // eslint-disable-next-line array-callback-return
        PHY_TRN_ARR.find((item: any) => {
          if (
            item.FBATCH === INV_TRN.FBATCH &&
            item.FSEQUENCE === INV_TRN.FSEQUENCE &&
            item.FTRACK === INV_TRN.FTRACK
          ) {
            PHY_TRN.push(item);
          }
        });
        this.logger.debug({ PHY_TRN }, 'OUTCLOSE > PHY_TRN');
        if (PHY_TRN && PHY_TRN.length > 0) {
          let lnpals = 0;
          let lnqty = 0;
          let InvTrnGrossWgt = INV_TRN.FGROSSWGT;
          let InvTrnFQTY = INV_TRN.FQTY;
          // eslint-disable-next-line no-restricted-syntax
          for (const PHYTRN of PHY_TRN) {
            // * Find The PHY_TRN Record
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const [PHY_MST] = await this.manager()
              .query(`BEGIN SELECT top 1 id, TRIM(ftrack) ftrack, TRIM(fserial) fserial, fqty, fpal, TRIM(fpalletid) fpalletid FROM
              PHY_MST WHERE FTRACK = '${PHYTRN.FTRACK}' AND FSERIAL = '${PHYTRN.FSERIAL}' ORDER BY FTRACK+FSERIAL ASC; END`);
            // can be removed
            // const PHY_MST = PHY_MST_ARR.find(
            //   (item: any) =>
            //     item.ftrack === PHYTRN.FTRACK &&
            //     item.fserial === PHYTRN.FSERIAL,
            // );

            if (PHY_MST) {
              let fqty = PHYTRN.FQTY;
              this.logger.debug(
                { PHY_MST, fqty },
                'OUTCLOSE > PHY_MST, PHYTRN.FQTY',
              );
              if (PHY_MST.fqty !== PHYTRN.FQTY) {
                fqty = PHY_MST.fqty;
              }
              const { fpal, id } = PHY_MST;
              let updatePhyMstPhyTrn = '';

              updatePhyMstPhyTrn = `UPDATE PHY_TRN SET FPAL = ${fpal}, FQTY = ${fqty} WHERE id = ${PHYTRN.ID};`;
              updatePhyMstPhyTrn = `${updatePhyMstPhyTrn} UPDATE PHY_MST SET FC_QTY = ${fqty}, FC_PAL =${fpal} WHERE id = ${id};`;
              await this.manager().query(`BEGIN ${updatePhyMstPhyTrn}; END;`);
              lnqty += fqty;
              lnpals += fpal;
            }
          }
          InvTrnFQTY = lnqty;
          const invMstCode2Qry = `
          UPDATE INV_TRN SET FPAL = ${lnpals}, FQTY = ${lnqty} WHERE ID = '${INV_TRN.ID}';
          DECLARE @INVMSTID int, @FCUSTCODE char(10), @FPRODGROUP char(5), @FPRODUCT char(16), @FOWNER char(10), @FSUPLRPROD char(16), @BATCHSEQ char(10), @FCATCHWGT char(1),
          @FTARE numeric(9,3), @FGROSSWGT numeric(11,3), @FNETWGT numeric(11,3), @CODEID int;
          SELECT TOP 1 @INVMSTID = id, @FCUSTCODE = FCUSTCODE,@FPRODGROUP = FPRODGROUP,@FPRODUCT = FPRODUCT, @FOWNER = FOWNER, @FSUPLRPROD = FSUPLRPROD, @BATCHSEQ = BATCHSEQ
            FROM INV_MST WHERE batchseq = '${INV_TRN.FTRACK}' ORDER BY FBATCH+FSEQUENCE ASC;
          SELECT TOP 1 @CODEID = ID, @FCATCHWGT = FCATCHWGT, @FTARE = FTARE, @FGROSSWGT = FGROSSWGT, @FNETWGT = FNETWGT FROM CODE2 WHERE FCUSTCODE = @FCUSTCODE AND FPRODGROUP = @FPRODGROUP AND FPRODUCT = @FPRODUCT AND FOWNER = @FOWNER AND FSUPLRPROD = @FSUPLRPROD
            ORDER BY FCUSTCODE+FPRODGROUP+FPRODUCT+FOWNER+FSUPLRPROD  ASC;
          SELECT @INVMSTID INVMSTID, @FCUSTCODE FCUSTCODE, @FPRODGROUP FPRODGROUP, @FPRODUCT FPRODUCT, @FOWNER FOWNER, @FSUPLRPROD FSUPLRPROD, @BATCHSEQ BATCHSEQ, @FCATCHWGT FCATCHWGT, @FTARE FTARE,
          @FGROSSWGT FGROSSWGT, @FNETWGT FNETWGT, @CODEID CODEID;
          `;
          const [invMstCode2Res] = await this.manager()
            .query(invMstCode2Qry)
            .catch(error => {
              this.logger.error(
                { fpal: lnpals, fqty: lnqty, batchseq: INV_TRN.FTRACK },
                'Error in INVMST/CODE2 FETCH Query',
                'RECEIVING > PROCESS_OUTCLOSE',
              );
              throw error;
            });

          this.logger.debug(
            { invMstCode2Res },
            'OUTCLOSE > INVMST (item.BatchSeq === INV_TRN.FTRACK)',
          );
          if (invMstCode2Res && invMstCode2Res.INVMSTID) {
            this.logger.debug({ invMstCode2Res }, 'OUTCLOSE > CODE2');
            let lciscwgt = 'N';
            if (
              invMstCode2Res.CODEID &&
              (invMstCode2Res.FCATCHWGT === 'I' ||
                invMstCode2Res.FCATCHWGT === 'B')
            ) {
              lciscwgt = 'Y';
            }
            let lnWgt2 = 0;
            let lnWgt1 = 0;
            this.logger.debug(
              {
                lciscwgt,
              },
              'OUTCLOSE > lciscwgt calculating weights',
            );
            // Get Total Net Weight
            if (lciscwgt === 'Y') {
              const PhyDetQuery = `SELECT ISNULL(sum(fnetwgt),0) as lnWgt2 FROM PHY_DET WHERE FBATCH = @0
                                AND FSEQUENCE = @1`;
              const [PHY_DET] = await this.manager()
                .query(`BEGIN ${PhyDetQuery} END;`, [
                  INV_TRN.FBATCH,
                  INV_TRN.FSEQUENCE,
                ])
                .catch(error => {
                  this.logger.error(
                    { FBATCH: INV_TRN.FBATCH, FSEQUENCE: INV_TRN.FSEQUENCE },
                    'Error in PHY_DET lnWgt2 FETCH Query',
                    'RECEIVING > PROCESS_OUTCLOSE',
                  );
                  throw error;
                });
              this.logger.debug(
                {
                  PHY_DET,
                },
                'OUTCLOSE > PHY_DET',
              );
              if (PHY_DET && PHY_DET.lnWgt2) {
                // let sum = 0
                // const phyDetLnWgt = await this.manager().query(
                //   `select sum(fnetwgt) as lnWgt2 from PHY_DET where fbatch = '${INV_TRN.FBATCH}' and fsequence = '${INV_TRN.FSEQUENCE}'`,
                // );
                lnWgt2 = PHY_DET.lnWgt2;
                lnWgt1 = lnWgt2 + invMstCode2Res.FTARE * lnqty;
              } else {
                lnWgt1 = invMstCode2Res.FGROSSWGT * lnqty;
                lnWgt2 = invMstCode2Res.FNETWGT * lnqty;
              }
            } else {
              lnWgt1 = invMstCode2Res.FGROSSWGT * lnqty;
              lnWgt2 = invMstCode2Res.FNETWGT * lnqty;
            }
            let updateInvMstInvTrn = '';
            updateInvMstInvTrn = `UPDATE INV_TRN SET FGROSSWGT = '${lnWgt1}', FNETWGT = '${lnWgt2}' WHERE  ID = '${INV_TRN.ID}';`;
            updateInvMstInvTrn = `${updateInvMstInvTrn} UPDATE INV_MST SET FC_GROSWGT = '${lnWgt1}', FC_NETWGT = '${lnWgt2}', FC_QTY = ${lnqty},   FC_PAL = ${lnpals} WHERE id =  ${invMstCode2Res.INVMSTID} ;`;
            InvTrnGrossWgt = lnWgt1;
            await this.manager().query(`BEGIN ${updateInvMstInvTrn} END;`);
          }
          lnQcount += lnqty;
          lnWcount += InvTrnGrossWgt;
          if (InvTrnFQTY === 0) {
            delInvTrnIds =
              delInvTrnIds === ''
                ? `${INV_TRN.ID}`
                : `${delInvTrnIds}, ${INV_TRN.ID}`;
          }
        }
        //  }
      }
      if (delInvTrnIds?.length > 0) {
        this.logger.debug({ delInvTrnIds }, 'OUTCLOSE > Deleting from INV_TRN');
        const deleteInvTrn = `DELETE FROM INV_TRN WHERE id IN (${delInvTrnIds}); `;
        await this.manager().query(`BEGIN ${deleteInvTrn}; END;`);
      }

      try {
        const fscanentime = this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');
        const fscanendte = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
        let loadOutLoadinQry = `UPDATE LOADOUT SET FSCANSTAT = 'C', FCHECKQTY = ${lnQcount}, FCHECKGROS = ${lnWcount}, FSCANENTME = '${fscanentime}', FSCANENDTE = '${fscanendte}'  WHERE ID = '${LOADOUT[0].ID}';`;

        const LOADIN = (recvo.LOADIN as unknown) as Loadin;
        if (LOADIN) {
          const { ffinishtme, ffinishdte } = LOADIN;
          this.logger.debug(
            { ffinishtme, ffinishdte },
            'OUTCLOSE > ffinishtme,ffinishdte',
          );
          loadOutLoadinQry = `${loadOutLoadinQry} UPDATE LOADIN SET ffinishdte = '${ffinishdte}', ffinishtme = '${ffinishtme}'  WHERE ID = '${LOADIN.id}';`;
        }
        await this.manager()
          .query(`BEGIN ${loadOutLoadinQry}; END;`)
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
    }
    this.logger.debug(
      {
        service: ReceivingService.name,
        curOper: recvo.curOper,
      },
      `receiving --> OUTCLOSE | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')}`,
    );
  }

  async SEEIFXDOCK(recvo: ReceivingVO): Promise<void> {
    if (
      recvo.lc_batch &&
      recvo.lc_batch.length > 0 &&
      recvo.LOADIN &&
      recvo.LOADIN?.fhasxdock !== true
    ) {
      /* const HASXDOCK = await this.invMstRepo().findOne({
        where: {
          fcanxdock: true,
          fproduct: recvo.lc_prod,
          fcustcode: recvo.lc_CustCode,
        }
      }); */
      const HASXDOCKresult = await this.manager().query(
        `BEGIN SELECT TOP 1 id FROM dbo.INV_MST WHERE fcanxdock = 1 and fproduct = '${recvo.lc_prod}' and fcustcode = '${recvo.lc_CustCode}' order by fbatch ASC ; END`,
      );
      const HASXDOCK: InvMst = HASXDOCKresult[0];
      if (HASXDOCK) {
        const LOADINresult = await this.manager().query(
          `BEGIN
            SELECT TOP 1 id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate, floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse, ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted, ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi, fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, TRIM(fscanwho) as fscanwho, fscanstdte, fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort, fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment, fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop, fschcoment, fsignintme, fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust, fgroupcode, fcpc, fconsignor, foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched, fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid, ftmsresend, cancelled
            FROM dbo.Loadin WHERE fbatch = '${recvo.lc_batch.padStart(
              7,
              '0',
            )}' order by fbatch ASC ;
          END`,
        );
        const LOADIN: Loadin = LOADINresult[0];
        if (LOADIN) {
          LOADIN.fhasxdock = true;
          await this.manager().query(
            `BEGIN UPDATE Loadin set fhasxdock = 1 WHERE fbatch = '${recvo.lc_batch.padStart(
              7,
              '0',
            )}'; END`,
          );
          recvo.LOADIN = LOADIN;
        }
      }
    }
  }

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
      .query(`BEGIN INSERT into INVCONTROL (
      foperid,fdatestamp,fworktype,fbatch,fpalletid, fproblem,fhowfixed, fcustcode, fwho, fwhen, fresolved) VALUES (
    '${fwho}', CAST([dbo].[Localdatetime](sysdatetime()) AS datetime2), 'RFDATECHEC', '${
      recvo.lc_batch
    }', '${recvo.lc_pal}', '${fproblem}', '${fhowfixed}', '${
      recvo.lc_CustCode
    }',
    '${fresolved ? fwho : ''}', ${fwhen}, ${fresolved ? 1 : 0}); END;`);
  }

  async validConsignee(tcConsignee: string): Promise<boolean> {
    let result: boolean = false;
    const CONSIGNEEres = await this.manager().query(
      `BEGIN SELECT TOP 1 TRIM(fcustcode) fcustcode from CONSIGNEE where fcustcode = '${tcConsignee}' order by fcustcode ASC ; END`,
    );
    // const CONSIGNEE = CONSIGNEEres[0];
    if (CONSIGNEEres.length > 0 && CONSIGNEEres[0]?.fcustcode.length > 0) {
      result = true;
    }
    return result;
  }

  async addUpdateConsCross(tcPal: string, tcConsignee: string): Promise<void> {
    await this.facilityService
      .getConnection()
      .createEntityManager()
      .transaction(async transactionalEntityManager => {
        await transactionalEntityManager.query(
          `MERGE CONSCROSS as Target
          USING (SELECT FTRACK,FSERIAL FROM PHY_MST WHERE FPALLETID=@0) as Source
          ON (Source.FTRACK=Target.FTRACK AND Source.FSERIAL=Target.FSERIAL)
          WHEN NOT MATCHED BY Target
          THEN INSERT (FTRACK,FSERIAL,FCONSCODE) VALUES (Source.FTRACK,Source.FSERIAL,@1)
          WHEN MATCHED THEN UPDATE SET Target.FCONSCODE = @1;`,
          [tcPal, tcConsignee],
        );
      });
  }

  YYWWDConverter(tcDate: string, tcDateType: string): string {
    let lcReturn: string = '';
    try {
      if (tcDate.length === 5 && (tcDateType === 'J' || tcDateType === 'C')) {
        const lcYy = tcDate.slice(0, 2);
        const lcWw = Number(tcDate.slice(2, 4));
        const lcD = Number(tcDate.slice(4, 5));
        if (lcWw > 0 && lcWw < 54 && lcD > 0 && lcD < 8) {
          let lastDay = moment();
          lastDay.set('year', Number(`20${lcYy}`));
          lastDay.set('month', 0);
          lastDay.set('date', 1);
          let day = (lcWw - 1) * 7 + (lcD - 2);
          day = day > 0 ? day : 0;
          day = day < 364 ? day : 364;
          lastDay = moment(lastDay).add(day, 'days');
          lcReturn = lastDay.format('YYYYMMDD');
          if (tcDateType === 'J') {
            lcReturn = this.RFDTOJ(lcReturn);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        { error, message: 'LOADIN error YYWWDConverter -->' },
        'Error in YYWWDConverter',
        ReceivingService.name,
      );
    }
    return lcReturn;
  }

  async getLotPatternConfig(recVO: ReceivingVO, CODE2: Code2) {
    const recvo = recVO;
    recvo.lc_LotPattern = '';
    recvo.ln_LotPatternStart = 0;

    /* const queryBuilder = this.codelkupRepo()
      .createQueryBuilder('codelkup')
      .select('*')
      .where('codelkup.flist=:cd', { cd: 'cd' });
    queryBuilder.andWhere(`codelkup.fcustcode Like '${CODE2.fcustcode}' or fcustcode='' `)
    const CODELKUP = await queryBuilder.getRawOne(); */
    const CODELKUPresult = await this.manager().query(
      `BEGIN SELECT top 1 id, flist, flong, fshort, fcustcode, fcustlong FROM dbo.CODELKUP WHERE FLIST='CD' AND (FCUSTCODE='${CODE2.fcustcode}' OR ISNULL(FCUSTCODE,'')='') order by FLIST+FCUSTCODE+FSHORT ASC ; END;`,
    );
    const CODELKUP: Codelkup = CODELKUPresult[0];
    if (CODELKUP) {
      if (
        `CD${CODE2.fcustcode}${CODE2.flotpatid}` ===
        `${CODELKUP.flist}${CODELKUP.fcustcode}${CODELKUP.fshort}`
      ) {
        recvo.lc_LotPattern =
          CODELKUP.flong && CODELKUP.flong.length > 0
            ? CODELKUP.flong.trim()
            : '';
        recvo.ln_LotPatternStart =
          Number.isNaN(CODELKUP.fcustlong) && Number(CODELKUP.fcustlong) > 0
            ? Number(CODELKUP.fcustlong)
            : 1;
      } else if (
        `CD${'          '}${CODE2.flotpatid}` ===
        `${CODELKUP.flist}${CODELKUP.fcustcode}${CODELKUP.fshort}`
      ) {
        recvo.lc_LotPattern =
          CODELKUP.flong && CODELKUP.flong.length > 0
            ? CODELKUP.flong.trim()
            : '';
        recvo.ln_LotPatternStart =
          Number.isNaN(CODELKUP.fcustlong) && Number(CODELKUP.fcustlong) > 0
            ? Number(CODELKUP.fcustlong)
            : 1;
      }
    }
  }

  LotPatternDateConverter(
    recvo: ReceivingVO,
    tcLotData: string,
    pcLotPattern: string,
    tnLotPatternStart: number,
    tcDateType: string,
  ): string {
    let lcReturn = tcLotData;
    const tcLotPattern = pcLotPattern.trim();
    try {
      const lnYCount: number = tcLotPattern.split('Y').length - 1;
      const lnMCount: number = tcLotPattern.split('M').length - 1;
      const lnDCount: number = tcLotPattern.split('D').length - 1;
      const lnJCount: number = tcLotPattern.split('J').length - 1;
      const lnACount: number = tcLotPattern.split('A').length - 1;

      if (
        lnYCount + lnMCount + lnDCount + lnJCount + lnACount !==
        tcLotPattern.length
      ) {
        return lcReturn;
      }
      if (tcLotPattern.length === 0) {
        return lcReturn;
      }
      if ([1, 2, 4].includes(lnYCount)) {
        return lcReturn;
      }
      if (
        lnJCount > 0 &&
        (lnMCount > 0 || lnDCount > 0 || lnJCount !== 3 || lnACount > 0)
      ) {
        return lcReturn;
      }
      if (
        lnDCount > 0 &&
        (lnDCount !== 2 ||
          lnJCount > 0 ||
          (lnMCount !== 2 && lnACount !== 3) ||
          (lnMCount === 2 && lnACount !== 0) ||
          (lnACount === 3 && lnMCount !== 0))
      ) {
        return lcReturn;
      }
      if (
        lnYCount !== tcLotPattern.split('Y').length - 1 &&
        (lnMCount === 0 || tcLotPattern.split('MM').length - 1 === 1) &&
        (lnDCount === 0 || tcLotPattern.split('DD').length - 1 === 1) &&
        (lnJCount === 0 || tcLotPattern.split('JJJ').length - 1 === 1) &&
        (lnACount === 0 || tcLotPattern.split('AAA').length - 1 === 1)
      ) {
        return lcReturn;
      }

      // TODO complete logic with moment with correct values while integration flow
      if (lnDCount === 2) {
        // && Gregorian date style in lot - YYYYMMDD
      } else {
        // Julian date style in lot - YYYYDDD
        lcReturn = recvo.lc_dtetyp === 'J' ? this.RFJTOD(lcReturn) : lcReturn;
      }
      this.logger.debug(
        'receiving-->',
        `LotPatternDateConverter --> ${tcLotPattern}, ${tnLotPatternStart}, ${tcDateType}`,
      );
      return lcReturn;
    } catch (error) {
      this.logger.error(
        { error, message: 'LotPatternDateConverter -->' },
        'Error in LotPatternDateConverter',
        ReceivingService.name,
      );
    }
    return lcReturn;
  }

  async processF2(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
    footer: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let outkey = recvo.curOper;
    const scrnUI = [];
    if (
      recvo.plCalcPRBBDate &&
      recvo.lc_bbdte.trim() === '' &&
      recvo.lc_BBJULIAN.trim() === '' &&
      (recvo.lc_bbdtetype === '1' || recvo.lc_bbdtetype === '2')
    ) {
      if (recvo.curOper === ReceivingState.MARK_PROCESS_DATE) {
        recvo.lc_dte = '';
        recvo.curOper =
          recvo.lc_bbdtetype === '1'
            ? ReceivingState.MARK_PROCESS_BB_JDATE
            : ReceivingState.MARK_PROCESS_BB_DATE;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        const b = getFields(
          recvo.lc_bbdtetype === '1'
            ? ReceivingState.MARK_PROCESS_BB_JDATE
            : ReceivingState.MARK_PROCESS_BB_DATE,
        );
        scrnUI.push(b);
        const d = getFields(
          recvo.lc_dtetyp === 'J'
            ? ReceivingState.SHOW_PROCESS_JDATE
            : ReceivingState.SHOW_PROCESS_CDATE,
        );
        d.readable = true;
        d.editable = false;
        d.avoidable = false;
        scrnUI.push(d);
        return new ResponseKeysDTO(
          plainToClass(PostResponseReceivingDTO, {
            errMsg: '',
            infoMsg: '',
            curOper: recvo.curOper,
            scrnUI,
            data: { footer },
          }),
          getOutFieldState(recvo.curOper),
          '',
          '',
          `${constant.F2_SKIP}~${constant.F5_EXIT}`,
        );
      }
      if (
        recvo.curOper === ReceivingState.MARK_PROCESS_BB_JDATE ||
        recvo.curOper === ReceivingState.MARK_PROCESS_BB_DATE
      ) {
        recvo.curOper = ReceivingState.MARK_PROCESS_DATE;
        outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
        const d = getFields(
          recvo.lc_dtetyp === 'J'
            ? ReceivingState.SHOW_PROCESS_JDATE
            : ReceivingState.SHOW_PROCESS_CDATE,
        );
        if (recvo.ll_ASNpal) {
          d.defaultVal = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
          d.value = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
        }
        scrnUI.push(d);
        const b = getFields(
          recvo.lc_bbdtetype === '1'
            ? ReceivingState.MARK_PROCESS_BB_JDATE
            : ReceivingState.MARK_PROCESS_BB_DATE,
        );
        b.readable = true;
        b.editable = false;
        b.avoidable = false;
        scrnUI.push(b);
        const CODE2 = (recvo.CODE2 as unknown) as Code2;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        return new ResponseKeysDTO(
          plainToClass(PostResponseReceivingDTO, {
            errMsg: '',
            infoMsg: '',
            curOper: recvo.curOper,
            data: { CODE2, footer },
            scrnUI,
          }),
          getOutputFields(outkey),
          '',
          '',
          `${constant.F2_SKIP}~${constant.F5_EXIT}`,
        );
      }
    }
    const CODE2 = (recvo.CODE2 as unknown) as Code2;
    outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
    const d = getFields(
      recvo.lc_dtetyp === 'J'
        ? ReceivingState.SHOW_PROCESS_JDATE
        : ReceivingState.SHOW_PROCESS_CDATE,
    );
    if (recvo.ll_ASNpal) {
      d.defaultVal = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
      d.value = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
    }
    scrnUI.push(d);
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
        data:
          recvo.curOper === ReceivingState.MARK_PROCESS_DATE
            ? { CODE2 }
            : undefined,
      }),
      recvo.curOper === ReceivingState.MARK_PROCESS_DATE
        ? getOutputFields(outkey)
        : getOutFieldState(recvo.curOper),
    );
  }

  async SCANDATE(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
    scanFields: string[] = [],
    footer: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let errMsg = '';
    let warnMsg = '';
    let lcDte = '';
    let data;
    const scrnUI = [];
    let isJdateOfLenFour = false;

    const timeZoneIANA = this.facilityService.getWareHouseSettings().timeZoneIANA;

    // line 1161 - && GET CODE DATE/JULIAN DATE SCANDATE
    let outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
    if (body.cdate && body.cdate.trim().length > 0 && outkey === 'codeDate') {
      lcDte = body.cdate.trim();
    } else if (
      body.jdate &&
      body.jdate.trim().length > 0 &&
      outkey === 'julinDate'
    ) {
      lcDte = body.jdate.trim();
    } else {
      errMsg = constant.DATE_EMPTY;
    }
    let configData: any = recvo?.CONFIG;
    let localeObj: any = {};
    if (configData && configData?.locale) {
      localeObj = JSON.parse(configData.locale);
    } else {
      [configData] = await this.manager().query(
        `SELECT TOP 1 locale from CONFIG`,
      );
      localeObj = JSON.parse(configData?.locale) || {};
    }
    let selectedFormat;
    let currenDtFormat;
    if (localeObj) {
      selectedFormat =
        localeObj.fDtFormat && localeObj.fDtFormat.length > 0
          ? localeObj.fDtFormat[0]
          : 'MM/DD/YYYY'; // MM/DD/YYYY
      currenDtFormat = selectedFormat.replace(new RegExp('/', 'g'), ''); // MMDDYYYY
    }
    const tCodeDate = moment(lcDte, 'MMDDYYYY').format(currenDtFormat);

    recvo.lc_dte = lcDte;
    if (lcDte.length === 5 && recvo.ll_yywwdcool && recvo.lc_dtetyp !== 'N') {
      lcDte = this.YYWWDConverter(lcDte, recvo.lc_dtetyp !== 'J' ? 'C' : 'J');
    }
    if (recvo.lc_dtetyp === 'N') {
      recvo.lc_dte = recvo.LOADIN.fbdate === null
        ? this.facilityService.getFacilityCurrentDateTimeFormatted('MMDDYYYY')
        : moment(recvo.LOADIN.fbdate, 'YYYY-MM-DD').format('MMDDYYYY');
      recvo.lc_olddte = recvo.lc_dte;
    } else if (
      recvo.lc_LotPattern.length > 0 &&
      recvo.lc_lot.length === 0 &&
      recvo.lc_dte.length >=
        recvo.lc_LotPattern.length + (recvo.ln_LotPatternStart - 1)
    ) {
      lcDte = this.LotPatternDateConverter(
        recvo,
        recvo.lc_dte,
        recvo.lc_LotPattern,
        recvo.ln_LotPatternStart,
        recvo.lc_dtetyp,
      );
      if (lcDte.length === 8) {
        lcDte = `${lcDte.slice(-4, lcDte.length)}${lcDte.slice(0, 4)}`;
      }
    }

    const CODE2 = (recvo.CODE2 as unknown) as Code2;
    if (!lcDte && lcDte.length === 0) {
      errMsg = constant.DATE_EMPTY;
    } else if (recvo.lc_dtetyp === 'J') {
      if (lcDte.length === 4) {
        lcDte = `${moment()
          .year()
          .toString()
          .slice(0, 3)}${lcDte}`;
        recvo.lc_dte = lcDte;
        isJdateOfLenFour = true;
      }
      if (recvo.lc_dte.length === 7) {
        const lncyear = Number(lcDte.slice(0, 4));
        const lncday = Number(lcDte.slice(4, 7));
        const y: number = moment().year();
        const d = moment();
        if (
          recvo.pl_future_date &&
          CODE2.fpickcode.slice(0, 2) === 'PR' &&
          !(lncyear >= y - recvo.ln_yearsback)
        ) {
          errMsg = constant.INVALID_JUL_YR;
          const lccdterr = `Batch ${
            recvo.lc_batch
          } \nPallet ${recvo.lc_pal.padEnd(
            20,
            ' ',
          )} had Julian Date ${lcDte} put in. This date was Incorrect as the year was not ${recvo.ln_yearsback
            .toString()
            .trim()} yr back  of ${d.format(selectedFormat)}\nPickCode is ${
            CODE2.fpickcode
          } Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            recvo,
            'JULIAN YEAR IS INCORRECT',
            lccdterr,
            true,
          );
        } else if (
          errMsg === '' &&
          !(lncyear >= y - recvo.ln_yearsback && lncyear - 1 <= y)
        ) {
          errMsg = constant.INVALID_JUL_YR;
          const lccdterr = `Batch ${
            recvo.lc_batch
          } \nPallet ${recvo.lc_pal.padEnd(
            20,
            ' ',
          )} had Julian Date ${lcDte} put in. This date was Incorrect as the year was not within ${recvo.ln_yearsback
            .toString()
            .trim()} yr back or 1 yr forward of ${d.format(
            selectedFormat,
          )}\nPickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            recvo,
            'JULIAN YEAR IS INCORRECT',
            lccdterr,
            true,
          );
        } else if (
          errMsg === '' &&
          !(
            lncday >= 1 &&
            lncday <=
              (moment()
                .year(lncyear)
                .isLeapYear()
                ? 366
                : 365)
          )
        ) {
          errMsg = constant.INVALID_JUL_DAY;
          const lccdterr = `Batch ${
            recvo.lc_batch
          } \nPallet ${recvo.lc_pal.padEnd(
            20,
            ' ',
          )} had Julian Date ${lcDte} put in.This date was Incorrect as the day was not between 1 and 366. \nPickCode is ${
            CODE2.fpickcode
          } Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            recvo,
            'JULIAN DAY IS INCORRECT',
            lccdterr,
            true,
          );
        }
        const ldPdate = moment(this.RFJTODate(lcDte));
        const currentDate = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
        const t = ldPdate.diff(currentDate, 'days');
        const a1 = recvo.pl_future_date && CODE2.fpickcode.slice(0, 2) === 'PR';
        const a3 =
          CODE2.fpickcode.slice(0, 2) !== 'SB' && CODE2.fpickcode !== 'FIFO';
        if (errMsg === '' && a3 && !a1) {
          if (CODE2.fcustcode === recvo.LOADIN.fcustcode && recvo.ffuturedte) {
            const newDate = moment(currentDate, 'YYYY-MM-DD').add(1, 'days');
            if (ldPdate > newDate) {
              errMsg = constant.PROD_TODAY;
              const lccdterr = `Batch ${
                recvo.lc_batch
              } \nPallet ${recvo.lc_pal.padEnd(
                20,
                ' ',
              )} had Julian Date ${lcDte} put in. \nThe Production date is ${ldPdate.format(
                selectedFormat,
              )} This date was Incorrect as the production date was > todays date ${d.format(
                selectedFormat,
              )} +1 \nPickCode is ${CODE2.fpickcode} Shelflife is ${
                CODE2.fshelflife
              }`;
              await this.WRITEINVCONTROL(
                fwho,
                recvo,
                'JULIAN PRODUCTION > TODAY+1',
                lccdterr,
                true,
              );
            }
          } else if (errMsg === '' && t > 0) {
            errMsg = constant.PROD_TODAY;
            const lccdterr = `Batch ${
              recvo.lc_batch
            } \nPallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} had Julian Date ${lcDte} put in. \nThe Production date is ${ldPdate.format(
              selectedFormat,
            )} This date was Incorrect as the production date was > todays date ${d.format(
              selectedFormat,
            )} \nPickCode is ${CODE2.fpickcode} Shelflife is ${
              CODE2.fshelflife
            }`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'JULIAN PRODUCTION > TODAY',
              lccdterr,
              true,
            );
          }
        }

        if (recvo.plIBRotationRestriction && errMsg === '') {
          const result = await this.manager().query(`BEGIN
Declare @pcNewestCodecount int, @pcNewestCodeDate char(7) = ''
SELECT @pcNewestCodecount = COUNT(*)  FROM [dbo].[INV_MST] AS [im]
WHERE im.FCUSTCODE = '${CODE2.fcustcode}' AND im.FPRODUCT = '${CODE2.fproduct}'
AND im.FOWNER = '${CODE2.fowner}' AND im.FSUPLRPROD = '${CODE2.fsuplrprod}' AND im.FRECTYPE = 'O';
IF @pcNewestCodecount > 0
      BEGIN
            SELECT @pcNewestCodeDate = ISNULL(max([im].[FJULIANDTE]),'" + "') FROM [dbo].[INV_MST] AS [im]
            WHERE im.FCUSTCODE = '${CODE2.fcustcode}' AND im.FPRODUCT = '${CODE2.fproduct}'
            AND im.FOWNER = '${CODE2.fowner}' AND im.FSUPLRPROD = '${CODE2.fsuplrprod}' AND im.FRECTYPE = 'O';
      END
SELECT TRIM(@pcNewestCodeDate) pcNewestCodeDate;
END;`);
          /**
           * In foxpro code they are checking IF pcNewestCodeDate = '' AND lc_dte < pcNewestCodeDate
           * but for Node this code is dead code so  removed empty condition
           * After removing this empty condition this code working same as wavelink
           * Author - Punit Kumar
           */
          if (
            result &&
            result.length > 0 &&
            result[0].pcNewestCodeDate &&
            result[0].pcNewestCodeDate !== '' &&
            Number(lcDte) < Number(result[0].pcNewestCodeDate)
          ) {
            warnMsg = constant.ROTATION_RESTRICTION;
            const chJulDate = getFields(ReceivingState.MARK_CHANGE_CODE_DATE);
            chJulDate.label = constant.CHANGE_JUL_DATE;
            chJulDate.avoidable = false;
            scrnUI.push(chJulDate);

            recvo.curOper = ReceivingState.MARK_CHANGE_CODE_DATE;
            const lccdterr = `Batch ${
              recvo.lc_batch
            } \nPallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} had Julian Date ${lcDte} put in. \nThe newest Julian Date received for that product is ${
              result[0].pcNewestCodeDate
            } This date is a problem as it is older than the newest Date for the product Received. \nPickCode is ${
              CODE2.fpickcode
            } Shelflife is ${CODE2.fshelflife}`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'INBOUND ROTATION RESTRICTION',
              lccdterr,
              false,
            );
            await this.cacheService.setcache(fwho, RECEIVING, recvo);
            return new ResponseKeysDTO(
              plainToClass(PostResponseReceivingDTO, {
                curOper: recvo.curOper,
                errMsg,
                warnMsg,
                scrnUI,
                data,
              }),
              getOutFieldState(recvo.curOper),
              '',
              '',
              `${constant.F5_EXIT}`,
            );
          }
        }

        const ldSbdate = ldPdate.add(CODE2.fshelflife, 'days');
        if (
          errMsg === '' &&
          ldSbdate.diff(moment().tz(timeZoneIANA), 'days') + 1 < 30 &&
          CODE2.fpickcode.slice(0, 2) === 'SB'
        ) {
          warnMsg = constant.EXP_DATE;
          const lccdterr = `Batch ${
            recvo.lc_batch
          } \nPallet ${recvo.lc_pal.padEnd(
            20,
            ' ',
          )} had Julian Date ${lcDte} put in. \nThe Sell By date is ${lcDte.slice(
            0,
            2,
          )}/${lcDte.slice(2, 4)}/${lcDte.slice(
            4,
          )}  This date is a problem as the Expiration date is < 30 days. \nPickCode is
          ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            recvo,
            'JULIAN EXPIRATION  < 30',
            lccdterr,
            false,
          );
        }
      } else {
        errMsg = constant.INVALID_JUL_DATE;
        const lccdterr = `Batch ${
          recvo.lc_batch
        } \nPallet ${recvo.lc_pal.padEnd(
          20,
          ' ',
        )} had Julian Date ${lcDte} put in. This date was Incorrect as it was not 7 Characters long.\nPickCode is ${
          CODE2.fpickcode
        } Shelflife is ${CODE2.fshelflife}`;
        await this.WRITEINVCONTROL(
          fwho,
          recvo,
          'JULIAN IS NOT 7 CHAR LONG',
          lccdterr,
          true,
        );
      }
    } else {
      recvo.lc_dte = lcDte;
      if (lcDte.length === 6) {
        lcDte = moment(recvo.lc_dte, 'MMDDYY').format('MMDDYYYY');
      }

      // Date coming in will be MMDDYY or MMDDYYYY
      if (recvo.lc_dte.length === 6 || recvo.lc_dte.length === 8) {
        const ldcdate =
          recvo.lc_dte.length === 6
            ? moment(recvo.lc_dte, 'MMDDYY')
            : moment(recvo.lc_dte, 'MMDDYYYY');
        const ldSbdateExp = moment(ldcdate, 'MMDDYYYY');
        let lncyear = ldcdate.year();
        let ldPdate;
        const ldSbdate =
          recvo.lc_dte.length === 6
            ? moment(recvo.lc_dte, 'MMDDYY')
            : moment(recvo.lc_dte, 'MMDDYYYY');
        if (CODE2.fpickcode.slice(0, 2) === 'SB') {
          ldPdate = ldcdate.subtract(CODE2.fshelflife, 'days');
          lncyear = ldPdate.year();
        } else {
          ldPdate = ldcdate;
        }
        if (recvo.pl_future_date && CODE2.fpickcode.slice(0, 2) === 'PR') {
          if (!(lncyear >= moment().year() - recvo.ln_yearsback)) {
            errMsg = constant.INVALID_DATE_YR;
            const lcCdterr = `Batch ${
              recvo.lc_batch
            } \nPallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} had Code Date ${lcDte} put in. This date was Incorrect as the year was not within ${recvo.ln_yearsback
              .toString()
              .trim()} yr back of ${moment().format(
              selectedFormat,
            )} \nPickCode is ${CODE2.fpickcode} Shelflife is ${
              CODE2.fshelflife
            }`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'CODE DATE YEAR IS INCORRECT',
              lcCdterr,
              true,
            );
          }
        } else if (
          errMsg === '' &&
          CODE2.fpickcode.slice(0, 2) !== 'SB' &&
          CODE2.fpickcode.slice(0, 4) !== 'FIFO'
        ) {
          if (
            !(
              lncyear >=
                moment()
                  .subtract(1, 'year')
                  .year() &&
              lncyear <=
                moment()
                  .add(1, 'year')
                  .year()
            )
          ) {
            errMsg = constant.INVALID_DATE_YR;
            const lcCdterr = `Batch ${
              recvo.lc_batch
            } \nPallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} had Code Date ${lcDte} put in. This date was Incorrect as the year was not within ${recvo.ln_yearsback
              .toString()
              .trim()} yr back or 1 yr forward of ${moment().format(
              selectedFormat,
            )} \nPickCode is  ${CODE2.fpickcode} Shelflife is ${
              CODE2.fshelflife
            }`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'CODE DATE YEAR IS INCORRECT',
              lcCdterr,
              true,
            );
          }
        } else {
          const lnshyear =
            CODE2.fpickcode.slice(0, 2) === 'SB'
              ? moment()
                  .subtract(CODE2.fshelflife, 'days')
                  .subtract(recvo.ln_yearsback, 'year')
              : moment().subtract(recvo.ln_yearsback, 'year');
          if (
            errMsg === '' &&
            !(
              lncyear >= lnshyear.year() &&
              lncyear <=
                moment()
                  .add(2, 'year')
                  .year()
            )
          ) {
            errMsg = constant.INVALID_DATE_YR;
            const lcCdterr = `Batch ${
              recvo.lc_batch
            } \nPallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} had Code Date ${lcDte} put in. This date was Incorrect as the year was not between ${lnshyear} and ${moment().year()} \nPickCode is ${
              CODE2.fpickcode
            } Shelflife is ${CODE2.fshelflife}`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'CODE DATE PROD > TODAY + 1',
              lcCdterr,
              true,
            );
            await this.cacheService.setcache(fwho, RECEIVING, recvo);
            return new ResponseKeysDTO(
              plainToClass(PostResponseReceivingDTO, {
                curOper: recvo.curOper,
                errMsg,
                warnMsg: '',
                scrnUI: [],
                data: '',
              }),
              getOutFieldState(recvo.curOper),
              '',
              '',
              `${constant.F5_EXIT}`,
            );
          }
        }
        const ldPdate1 = moment(ldPdate, 'YYYY-MM-DD');
        const currentDate = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
        const t = ldPdate1.diff(currentDate, 'days');
        const a1 = recvo.pl_future_date && CODE2.fpickcode.slice(0, 2) === 'PR';
        const a2 = t > 0;
        const a3 =
          CODE2.fpickcode.slice(0, 2) !== 'SB' && CODE2.fpickcode !== 'FIFO';
        if (errMsg === '' && !a1 && a2 && a3) {
          if (CODE2.fcustcode === recvo.LOADIN.fcustcode && recvo.ffuturedte) {
            const newDate = moment(currentDate, 'YYYY-MM-DD').add(1, 'days');
            if (ldPdate1 > newDate) {
              errMsg = constant.PROD_TODAY;
              const lcCdterr = `Batch ${
                recvo.lc_batch
              } \nPallet ${recvo.lc_pal.padEnd(
                20,
                ' ',
              )} had Code Date ${tCodeDate} put in. \nThe Production date is ${ldPdate.format(
                selectedFormat,
              )}. This date was Incorrect as the production date was > todays date ${moment().format(
                selectedFormat,
              )} +1 \nPickCode is ${CODE2.fpickcode} Shelflife is ${
                CODE2.fshelflife
              }`;
              await this.WRITEINVCONTROL(
                fwho,
                recvo,
                'CODE DATE PROD > TODAY + 1',
                lcCdterr,
                true,
              );
            }
          } else {
            errMsg = constant.PROD_TODAY;
            const lcCdterr = `Batch ${
              recvo.lc_batch
            } \nPallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} has Code Date ${tCodeDate} put in. \nThe Production date is ${ldPdate.format(
              selectedFormat,
            )}. This date was Incorrect as the production date was > todays date ${moment().format(
              selectedFormat,
            )} \nPickCode is ${CODE2.fpickcode} Shelflife is ${
              CODE2.fshelflife
            }`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'CODE DATE PRODUCTION > TODAY',
              lcCdterr,
              true,
            );
          }
        }

        if (recvo.plIBRotationRestriction) {
          const result = await this.manager().query(`BEGIN
              Declare @pcNewestCodecount int, @pcNewestCodeDate char(10) = ''
              SELECT @pcNewestCodecount = COUNT(*)  FROM [dbo].[INV_MST] AS [im]
              WHERE im.FCUSTCODE = '${CODE2.fcustcode}' AND im.FPRODUCT = '${CODE2.fproduct}'
              AND im.FOWNER = '${CODE2.fowner}' AND im.FSUPLRPROD = '${CODE2.fsuplrprod}' AND im.FRECTYPE = 'O';
              IF @pcNewestCodecount > 0
                    BEGIN
                          SELECT @pcNewestCodeDate = ISNULL(max([im].[FCODEDTE]),'" + "') FROM [dbo].[INV_MST] AS [im]
                          WHERE im.FCUSTCODE = '${CODE2.fcustcode}' AND im.FPRODUCT = '${CODE2.fproduct}'
                          AND im.FOWNER = '${CODE2.fowner}' AND im.FSUPLRPROD = '${CODE2.fsuplrprod}' AND im.FRECTYPE = 'O';
                    END
              SELECT TRIM(@pcNewestCodeDate) pcNewestCodeDate;
              END;`);
          const ldcDate = moment(lcDte, 'MMDDYYYY');
          const cdt = moment(result[0].pcNewestCodeDate, 'YYYY-MM-DD');
          if (
            result &&
            result.length > 0 &&
            result[0].pcNewestCodeDate !== '' &&
            cdt.isValid() &&
            cdt.format('YYYY') !== '1900' &&
            ldcDate < cdt
          ) {
            warnMsg = constant.ROTATION_RESTRICTION;
            recvo.curOper = ReceivingState.MARK_CHANGE_CODE_DATE;

            const chCdDate = getFields(ReceivingState.MARK_CHANGE_CODE_DATE);
            chCdDate.label = constant.CHANGE_CODE_DATE;
            chCdDate.avoidable = false;
            scrnUI.push(chCdDate);
            const lccdterr = `Batch ${
              recvo.lc_batch
            } \nPallet ${recvo.lc_pal.padEnd(
              20,
              ' ',
            )} had Code Date ${ldcDate.format(
              selectedFormat,
            )} put in. \nThe newest Code Date received for that product is ${cdt.format(
              selectedFormat,
            )} This date is a problem as it is older than the newest Date for the product Received. \nPickCode is ${
              CODE2.fpickcode
            } Shelflife is ${CODE2.fshelflife}`;
            await this.WRITEINVCONTROL(
              fwho,
              recvo,
              'INBOUND ROTATION RESTRICTION',
              lccdterr,
              false,
            );
            await this.cacheService.setcache(fwho, RECEIVING, recvo);
            return new ResponseKeysDTO(
              plainToClass(PostResponseReceivingDTO, {
                curOper: recvo.curOper,
                errMsg,
                warnMsg,
                scrnUI,
                data,
              }),
              getOutFieldState(recvo.curOper),
              '',
              '',
              `${constant.F5_EXIT}`,
            );
          }
        }

        if (
          errMsg === '' &&
          ldSbdateExp.diff(moment().tz(timeZoneIANA), 'days') + 1 < 30 &&
          CODE2.fpickcode.slice(0, 2) === 'SB'
        ) {
          warnMsg = constant.EXP_DATE;
          const lcCdterr = `Batch ${
            recvo.lc_batch
          } \nPallet ${recvo.lc_pal.padEnd(
            20,
            ' ',
          )} had Code Date ${tCodeDate} put in. \nThe Sell By date is ${tCodeDate.slice(
            0,
            2,
          )}/${tCodeDate.slice(2, 4)}/${tCodeDate.slice(
            4,
          )}  This date is a problem as the Expiration date is < 30 days. \nPickCode is ${
            CODE2.fpickcode
          } Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            recvo,
            'CODE DATE EXPIRATION < 30',
            lcCdterr,
            false,
          );
        }
      } else {
        errMsg = constant.INVALID_CODE_DATE;
      }
    }

    if (errMsg === '') {
      recvo.lc_dte = lcDte;
      // coming here after LOT
      if (recvo.pl_AutoDateForProdLot && recvo.lc_keylot === 'Y') {
        recvo.curOper = this.findNextState(recvo);
        if (recvo.curOper === ReceivingState.MARK_PROCESS_TEMP) {
          const q = getFields(ReceivingState.MARK_PROCESS_TEMP);
          q.defaultVal = recvo.curTempVal;
          scrnUI.push(q);
        }
        if (recvo.curOper === ReceivingState.MARK_PROCESS_CLOT) {
          const clot = getFields(ReceivingState.MARK_PROCESS_CLOT);
          if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
            clot.maxFieldLen = recvo.RFREQ.fscanlngth;
          scrnUI.push(clot);
        }
        if (recvo.curOper === ReceivingState.MARK_SEND_PALLET) {
          // const o: OSummary = new OSummary();
          // o.labels = this.summary(recvo);
          // if (o.labels.length > 0) {
          //   scrnUI.push(o);
          // }
          data = { label: getLabelFields('assumeText') };
          // const footerData = `${constant.F7_DIMS}`;
          scrnUI.push(...this.summary2(recvo));
        } else if (recvo.curOper === ReceivingState.MARK_PROCESS_CONSIGNEE) {
          const CODE2 = (recvo.CODE2 as unknown) as Code2;
          const lcConscode =
            recvo.plAutoFillConsignee && CODE2.fproduct.length > 3
              ? CODE2.fproduct.slice(0, 3)
              : '';
          const c = getFields(ReceivingState.MARK_PROCESS_CONSIGNEE);
          c.label = recvo.pnHandKeyConsigneeCross
            ? constant.CONSIGNEE
            : constant.SCAN_CONSIGNEE;
          c.defaultVal = lcConscode;
          c.value = lcConscode;
          c.isScanable = recvo.pnHandKeyConsigneeCross;
          scrnUI.push(c);
        }
        outkey = '';
      } else {
        const q = getFields(ReceivingState.MARK_PROCESS_QTY);
        q.badOneOfValidMsg = `${constant.QTY_TIE} ${recvo.ln_intie} X ${recvo.ln_high} ${constant.OK_QUES}`;
        q.justDisplay = `${recvo.ln_intie * recvo.ln_high}`;
        if (recvo.ll_ASNpal && recvo.ll_ASNpalNoQty === false) {
          let tempqty = Number(recvo.lc_qty).toString();
          tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
          q.defaultVal = tempqty;
          q.value = tempqty;
        } else {
          q.defaultVal = '';
          q.value = '';
        }
        if (recvo.lc_dtetyp === 'J' && isJdateOfLenFour) {
          let jDateScrnUi = getFields(ReceivingState.SHOW_PROCESS_JDATE);
          jDateScrnUi.readable = true;
          jDateScrnUi.value = recvo.lc_dte;
          jDateScrnUi.defaultVal = recvo.lc_dte;
          scrnUI.push(jDateScrnUi);
        }
        scrnUI.push(q);
        outkey = 'qty';
        recvo.curOper = ReceivingState.MARK_PROCESS_QTY;
      }
      if (
        errMsg === '' &&
        recvo.plCalcPRBBDate &&
        recvo.ll_ASNpal &&
        recvo.lc_dtetyp === 'J'
      ) {
        recvo.lc_dte = lcDte;
        recvo.lc_jdte = '';
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else if (
      recvo.plCalcPRBBDate &&
      (recvo.lc_bbdtetype === '1' || recvo.lc_bbdtetype === '2')
    ) {
      data = { CODE2: recvo.CODE2, footer };
    } else {
      data = { CODE2: recvo.CODE2 };
    }

    if (
      errMsg === '' &&
      recvo.plCalcPRBBDate &&
      (recvo.lc_bbdtetype === '1' || recvo.lc_bbdtetype === '2') &&
      (recvo.lc_BBJULIAN.trim() === '' || recvo.lc_bbdte.trim() === '')
    ) {
      const result = await this.storedProceduresNewService.getRfCalculateproductionorbestbydate(
        {
          bestbycodedate: '1900-01-01',
          bestbyjulian: '',
          codedate:
            recvo.lc_dtetyp === 'J'
              ? '01/01/1991'
              : moment(lcDte, 'MMDDYYYY').format('MM/DD/YYYY'),
          customercode: recvo.CODE2.fcustcode,
          juliandate: recvo.lc_dtetyp === 'J' ? lcDte : '',
          owner: recvo.CODE2.fowner,
          product: recvo.CODE2.fproduct,
          productgroup: recvo.CODE2.fprodgroup,
          supplierproduct: recvo.CODE2.fsuplrprod,
        },
      );

      if (result && result.output) {
        recvo.lc_BBJULIAN = result.output.bestbyjulian;
        recvo.lc_bbdte = moment(result.output.bestbycodedate).format(
          'MMDDYYYY',
        );
        const bdt = getFields(
          recvo.lc_bbdtetype === '1'
            ? ReceivingState.MARK_PROCESS_BB_JDATE
            : ReceivingState.MARK_PROCESS_BB_DATE,
        );
        bdt.defaultVal =
          recvo.lc_bbdtetype === '1' ? recvo.lc_BBJULIAN : recvo.lc_bbdte;
        bdt.value =
          recvo.lc_bbdtetype === '1' ? recvo.lc_BBJULIAN : recvo.lc_bbdte;
        bdt.readable = true;
        scrnUI.push(bdt);
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }

    if (scanFields.includes('prod') && scanFields.includes('cdate')) {
      const d = getFields(
        recvo.lc_dtetyp === 'J'
          ? ReceivingState.SHOW_PROCESS_JDATE
          : ReceivingState.SHOW_PROCESS_CDATE,
      );
      d.defaultVal = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
      d.value = recvo.lc_dtetyp === 'J' ? recvo.lc_jdte : recvo.lc_dte;
      scrnUI.push(d);
      if (errMsg !== '') {
        errMsg = '';
      }
      const p = getFields(ReceivingState.MARK_PROCESS_PROD);
      if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
        p.maxFieldLen = recvo.RFREQ.fscanlngth;
      p.defaultVal = recvo.lc_prod;
      p.value = recvo.lc_prod;
      scrnUI.push(p);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg,
        warnMsg,
        scrnUI,
        data,
      }),
      outkey ? getOutputFields(outkey) : getOutFieldState(recvo.curOper),
      '',
      '',
      recvo.curOper === ReceivingState.MARK_SEND_PALLET
        ? `${constant.F7_DIMS}`
        : data?.footer
        ? `${constant.F2_SKIP}~${constant.F5_EXIT}`
        : `${constant.F5_EXIT}`,
    );
  }

  async changeCodeDate(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let infoMsg;
    const scrnUI = [];
    let errMsg = '';
    let outkey = 'lckeepCdDate';
    if (
      body.lckeepCdDate &&
      ['Y', 'N'].includes(body?.lckeepCdDate.trim().toUpperCase())
    ) {
      outkey = 'qty';
      recvo.curOper =
        body.lckeepCdDate.toUpperCase() === 'Y'
          ? ReceivingState.MARK_PROCESS_DATE
          : ReceivingState.MARK_PROCESS_QTY;
      if (recvo.curOper === ReceivingState.MARK_PROCESS_QTY) {
        // recvo.lc_dte = lcDte;
        const q = getFields(ReceivingState.MARK_PROCESS_QTY);
        q.badOneOfValidMsg = `${constant.QTY_TIE} ${recvo.ln_intie} X ${recvo.ln_high} ${constant.OK_QUES}`;
        q.justDisplay = `${recvo.ln_intie * recvo.ln_high}`;
        if (recvo.ll_ASNpal && recvo.ll_ASNpalNoQty === false) {
          let tempqty = Number(recvo.lc_qty).toString();
          tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
          q.defaultVal = tempqty;
          q.value = tempqty;
        } else {
          q.defaultVal = '';
          q.value = '';
        }
        scrnUI.push(q);
        // const outkey = 'qty';
        recvo.curOper = ReceivingState.MARK_PROCESS_QTY;
      } else {
        recvo.curOper = ReceivingState.MARK_PROCESS_DATE;
        outkey = recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate';
        const d = getFields(
          recvo.lc_dtetyp === 'J'
            ? ReceivingState.SHOW_PROCESS_JDATE
            : ReceivingState.SHOW_PROCESS_CDATE,
        );
        scrnUI.push(d);
      }

      const qyn = getFields(ReceivingState.MARK_CHANGE_CODE_DATE);
      qyn.avoidable = true;
      scrnUI.push(qyn);

      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    } else {
      errMsg = constant.BLAST_MUST_YN;
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg,
        curOper: recvo.curOper,
        scrnUI,
      }),
      getOutputFields(outkey),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async ZERO(recvo: ReceivingVO) {
    await this.manager().query(
      `BEGIN
        DECLARE @countPHY_MST INT, @phyMstTrack CHAR(10), @idPHYTRN INT,  @phyMstSerial CHAR(4),   @fbatchPHYTRN CHAR(7), @fseqPHYTRN CHAR(3),
        @fseialPHYTRN CHAR(4), @ftrackPHYTRN CHAR(10);
        SELECT @phyMstTrack = FTRACK, @phyMstSerial =  FSERIAL   FROM PHY_MST WHERE FPALLETID = '${recvo.lc_pal}';
        SELECT @idPHYTRN = id, @fbatchPHYTRN = FBATCH, @fseqPHYTRN =  FSEQUENCE, @fseialPHYTRN = FSERIAL, @ftrackPHYTRN  =  FTRACK
        from PHY_TRN WHERE FBATCH = '${recvo.lc_batch}' AND FTRACK = @phyMstTrack AND FSERIAL = @phyMstSerial;
        DELETE FROM PHY_MST WHERE FPALLETID = '${recvo.lc_pal}';
        UPDATE dbo.PHY_MST SET fmarriedpalletid = NULL, fpalletstack = NULL where fmarriedpalletid = '${recvo.lc_pal}';
        DELETE FROM[dbo].[PHY_DET] WHERE FBATCH = @fbatchPHYTRN AND FSEQUENCE =@fseqPHYTRN AND FTRACK =@ftrackPHYTRN AND FSERIAL =@fseialPHYTRN;
        DELETE FROM[dbo].[INV_MST] WHERE FBATCH = @fbatchPHYTRN AND FSEQUENCE =@fseqPHYTRN and not exists(select 1 from dbo.PHY_MST where ftrack = @ftrackPHYTRN);
        IF @@ROWCOUNT> 0 DELETE FROM[dbo].[INV_TRN] where FBATCH = @fbatchPHYTRN AND FSEQUENCE = @fseqPHYTRN;
        DELETE FROM[dbo].[PHY_TRN] WHERE id =@idPHYTRN;
    END`,
    );
  }

  async INCREATE(
    fwho: string,
    recvo: ReceivingVO,
    body: PostRequestReceivingDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const palletID = recvo.lc_pal;
    const startTime = moment();
    this.logger.debug(
      `receiving-- > INCREATE | Start time ${moment().format(
        'HH:mm:ss-SSS',
      )} | ${fwho} | ${recvo.curOper} `,
      ReceivingService.name,
    );
    let lcJulian = '';
    let lcCddte = '';
    let errMsg = '';
    let warnMsg = '';
    let infoMsg = '';
    const scrnUI = [];
    let markResult = '';
    let footerData = `${constant.F5_EXIT}`;
    const lcDte = recvo.lc_dte;
    lcJulian = recvo.lc_dtetyp === 'J' ? lcDte : '       ';
    let ldyear;
    if (recvo.lc_dtetyp === 'C' || recvo.lc_dtetyp === 'N') {
      ldyear =
        lcDte.trim().length === 6
          ? `${Number(lcDte.slice(4, 6)) < 96 ? '20' : '19'}${lcDte.slice(
              4,
              6,
            )} `
          : lcDte.slice(4, 8);
      lcCddte = `${ldyear}-${lcDte.slice(0, 2)}-${lcDte.slice(2, 4)}`;
      if (recvo.lc_dte.length === 6) {
        recvo.lc_dte = moment(recvo.lc_dte, 'MMDDYY').format('MMDDYYYY');
      }
      lcJulian = this.RFDTOJ(recvo.lc_dte);
    } else {
      lcJulian = lcDte;
      lcCddte = moment(this.RFJTOD(recvo.lc_dte), 'MMDDYYYY').format(
        'YYYY-MM-DD',
      );
    }

    let lcBbcddte = '';
    let lcBbjulian = '       ';
    const lcBbdtetype = recvo.lc_bbdtetype;
    const lcBbdte = recvo.lc_bbdte;
    if (lcBbdtetype && lcBbdtetype.trim().length > 0) {
      lcBbjulian = lcBbdtetype === '1' ? lcBbdte : '       ';
      if (lcBbdtetype === '2') {
        ldyear =
          lcBbdte.trim().length === 6
            ? `${Number(lcBbdte.slice(4, 6)) < 96 ? '20' : '19'}${lcBbdte.slice(
                4,
                6,
              )}`
            : lcBbdte.slice(4, 8);
        lcBbcddte = `${lcBbdte.slice(0, 2)}/${lcBbdte.slice(2, 4)}/${ldyear}`;
        lcBbjulian = this.RFDTOJ(lcBbdte);
      } else if (lcBbdtetype === '1') {
        ldyear =
          lcBbdte.trim().length === 6
            ? `${Number(lcBbdte.slice(4, 6)) < 96 ? '20' : '19'}${lcBbdte.slice(
                4,
                6,
              )}`
            : lcBbdte.slice(4, 8);
        lcBbcddte = `${lcBbdte.slice(0, 2)}/${lcBbdte.slice(2, 4)}/${ldyear}`;
        lcBbjulian = recvo.lc_BBJULIAN;
      }
    }

    recvo.lc_estb = recvo.lc_estb
      .trim()
      .toUpperCase()
      .padEnd(15, ' ');
    recvo.lc_slaughdte = recvo.lc_slaughdte
      .trim()
      .toUpperCase()
      .padEnd(10, ' ');
    recvo.lc_clot = recvo.lc_clot
      .trim()
      .toUpperCase()
      .padEnd(16, ' ');
    const lcSendDtetyp = recvo.lc_dtetyp === 'N' ? 'C' : recvo.lc_dtetyp;
    const CODE2 = (recvo.CODE2 as unknown) as Code2;

    // line 2803 to 2879 && batch,lot,prodouct found
    let llk1exist = false;
    if (recvo.lc_lot.trim().length === 0) {
      llk1exist = true;
    }

    if (llk1exist) {
      if (recvo.lc_dtetyp === 'J') {
        const fbbcodedte =
          recvo.lc_bbdte?.length > 0
            ? moment(recvo.lc_bbdte, 'MMDDYYYY').format('YYYY-MM-DD')
            : '';
        const [INV_MST1] = await this.manager()
          .query(
            `SELECT TOP 1 flot, id FROM INV_MST WHERE fbatch = '${recvo.lc_batch}' AND fproduct = '${recvo.lc_prod}' AND festnum = '${recvo.lc_estb}'
          AND fslaughdte = '${recvo.lc_slaughdte}' AND fcustlot = '${recvo.lc_clot}' AND fjuliandte = '${lcBbjulian}' AND
          fbbcodedte = '${fbbcodedte}' and flot = '${recvo.lc_lot}' ORDER by FBATCH;`,
          )
          .catch(err => {
            this.logger.error(
              {
                fbbcodedte,
                fbatch: recvo.lc_batch,
                fslaughdte: recvo.lc_slaughdte,
              },
              'Error in INVMST1 FETCH Query',
              'RECEIVING > PROCESS_INCREATE',
            );
            throw err;
          });
        if (INV_MST1) {
          llk1exist = true;
          recvo.lc_lot = INV_MST1.flot;
        }
      } else {
        const fbbcodedte =
          recvo.lc_bbdte?.length > 0
            ? moment(recvo.lc_bbdte, 'MMDDYYYY').format('YYYY-MM-DD')
            : '';
        const [INV_MST2] = await this.manager()
          .query(
            `SELECT TOP 1 flot, id FROM INV_MST WHERE fbatch = '${recvo.lc_batch}' AND fproduct = '${recvo.lc_prod}' AND festnum = '${recvo.lc_estb}'
          AND fslaughdte = '${recvo.lc_slaughdte}' AND fcustlot = '${recvo.lc_clot}' AND
          fbbcodedte = '${fbbcodedte}' and fcodedte = '${lcCddte}' and flot = '${recvo.lc_lot}' ORDER by FBATCH;`,
          )
          .catch(err => {
            this.logger.error(
              {
                fbbcodedte,
                fbatch: recvo.lc_batch,
                fslaughdte: recvo.lc_slaughdte,
                lcCddte,
              },
              'Error in INVMST2 FETCH Query',
              'RECEIVING > PROCESS_INCREATE',
            );
            throw err;
          });
        if (INV_MST2) {
          llk1exist = true;
          recvo.lc_lot = INV_MST2.flot;
        }
      }
    }
    let receivePlatformType = false;
    const CONFIG = (recvo.CONFIG as unknown) as Config;
    if (CONFIG && CONFIG?.receivePlatformType) {
      receivePlatformType = CONFIG.receivePlatformType;
    }
    if (Number(recvo.lc_qty) !== 0) {
      if (recvo.curOper !== ReceivingState.MARK_VERIFY_PALLET) {
        const result = await this.storedProceduresNewService.getInboundsIncreate(
          {
            inCode2Id: CODE2.id,
            inFbatch: recvo.lc_batch,
            inFhold: CODE2.fhold,
            inProd: recvo.lc_prod
              .trim()
              .toUpperCase()
              .padEnd(16, ' '),
            inLot: recvo.lc_lot
              .trim()
              .toUpperCase()
              .padEnd(16, ' '),
            inBatchprodedistatus: recvo.ll_BatchProdEdiStatus,
            inGlOfcputflag: CONFIG?.ofcputflag === true,
            inLcBbcddte: lcBbcddte.length > 0 ? lcBbcddte : undefined,
            inLcBbdtetype: recvo.lc_bbdtetype,
            inLcBbjulian: lcBbjulian.padEnd(7, ' '),
            inLcCustcode: recvo.lc_CustCode.padEnd(10, ' '),
            inLcCustpal: recvo.lc_custpal.padEnd(20, ' '),
            inLcCddte: lcCddte,
            inLcClot: recvo.lc_clot,
            inLcCoolcode: recvo.lc_CoolCode,
            inLcEstb: recvo.lc_estb,
            inLcPal: recvo.lc_pal.padEnd(20, ' '),
            inLcInit: fwho.padEnd(7, ' '),
            inLcJulian: lcJulian,
            inLcQty: recvo.lc_qty.padEnd(5, ' '),
            inLcRef: recvo.lc_ref.padEnd(15, ' '),
            inLcSlaughdte: recvo.lc_slaughdte.padEnd(10, ' '),
            inLcDtetyp: lcSendDtetyp,
            inLlQuickrcv: recvo.llQuickrcv,
            inLlYywwdcool: recvo.ll_yywwdcool,
            inDatetime: this.facilityService.getFacilityCurrentDateTimeFormatted('MM/DD/YYYY HH:mm:ss'),
            inLnTemp: (Number.isNaN(recvo.lc_temp) ? 0 : Number(recvo.lc_temp))
              .toString()
              .padEnd(8, ' '),
            inLcFtie: (Number.isNaN(recvo.ln_intie)
              ? 0
              : Number(recvo.ln_intie)
            )
              .toString()
              .padEnd(3, ' '),
            inLcFlength: (Number.isNaN(recvo.pnLength)
              ? 0
              : Number(recvo.pnLength)
            )
              .toString()
              .padEnd(10, ' '),
            inLcFwidth: (Number.isNaN(recvo.pnWidth)
              ? 0
              : Number(recvo.pnWidth)
            )
              .toString()
              .padEnd(10, ' '),
            inLcFheight: (Number.isNaN(recvo.pnHeight)
              ? 0
              : Number(recvo.pnHeight)
            )
              .toString()
              .padEnd(10, ' '),
          },
        );
        // && display the lot number
        let inLot = recvo.lc_lot;
        if (
          result &&
          result.output &&
          result.output.in_lot &&
          result.output.in_lot !== ''
        ) {
          inLot = result.output.in_lot;
          if (inLot && inLot.length < 2) {
            const INV_MST: InvMst[] = await this.facilityService
              .getConnection()
              .createEntityManager()
              .query(
                `SELECT TOP 1 FLOT as flot from INV_MST WHERE  FBATCH = '${recvo.lc_batch}' order by SQLDATETIME DESC;`,
              );
            if (INV_MST && INV_MST.length > 0 && INV_MST[0].flot) {
              inLot = INV_MST[0].flot;
            }
            recvo.lc_lot = inLot.trim();
          } else {
            recvo.lc_lot = inLot;
          }
        }
        warnMsg = `${constant.LOT} ${recvo.lc_lot}`;
      }

      await this.beltPrinterService.loadLabels<ReceivingVO>(
        fwho,
        recvo,
        ModuleNameEnum.RECEIVE,
      );

      const customer = await this.manager().query(
        `SELECT top 1 c.InboundPalletLabel FROM Customer c WHERE FCUSTCODE = '${recvo.LOADIN?.fcustcode}'`,
      );

      //retreive dynamic attribute value and save in the corresponding table
      if (body.dynamicAttr) {
        const dynamicAttrValues = await this.dynamicAttributesService.processDynamicAttributes(this.manager(), recvo.lc_CustCode, recvo.lc_prod, body.dynamicAttr, recvo.lc_batch);
        await this.dynamicAttributesService.saveDynamicAttributes(this.manager(), dynamicAttrValues, recvo.lc_batch, palletID, fwho);
      }
      if (
        recvo.curOper !== ReceivingState.MARK_VERIFY_PALLET &&
        !recvo.ll_iscatch &&
        (recvo.labelsList.length > 0 ||
          recvo.noScanLabels.length > 0 ||
          (customer && customer[0]?.InboundPalletLabel?.trim()) ||
          recvo.plUsedF8) &&
        body.sndPal &&
        ['Y', ''].includes(body.sndPal.trim().toUpperCase())
      ) {
        return this.beltPrinterService.printerScreen<ReceivingVO>(
          fwho,
          recvo,
          recvo.lc_pal,
          warnMsg,
          ModuleNameEnum.RECEIVE,
          'processSendPallet',
          constant,
        );
      }

      if (
        recvo.ll_iscatch &&
        recvo.curOper !== ReceivingState.MARK_VERIFY_PALLET
      ) {
        // && see if is a catchweight

        recvo.lc_qty = Number.isNaN(recvo.lc_qty) ? '-9' : recvo.lc_qty;
        recvo.lc_custpal = recvo.lc_custpal.toUpperCase();
        recvo.lc_pal = recvo.lc_pal.toUpperCase();
        let plFoundEDIPallet: boolean = false;
        const rfInbounds = await this.storedProceduresNewService.getRfInboundsedicatchweights(
          {
            batch: recvo.lc_batch,
            foundedipallet: '',
            lot: recvo.lc_lot,
            palletid: recvo.lc_pal,
            userid: fwho,
          },
        );
        if (
          rfInbounds &&
          rfInbounds.output &&
          rfInbounds.output.foundedipallet > 0
        ) {
          plFoundEDIPallet = true;
        }
        if (plFoundEDIPallet) {
          errMsg = constant.WEIGHTS_SYS;
          if (!recvo.llQuickrcv) {
            if (receivePlatformType) {
              recvo.curOper = ReceivingState.MARK_PALLET_TYPE;
              await this.cacheService.setcache(fwho, RECEIVING, recvo);
            } else {
              markResult = await this.processPallHist(fwho, recvo, constant);
            }
          } else {
            markResult = await this.processPallHist(fwho, recvo, constant);
          }
        } else {
          const cvo: CatchWeightVO = new CatchWeightVO();
          cvo.originator = RECEIVING;
          cvo.palId = recvo.lc_pal;
          cvo.prdCde = recvo.lc_prod;
          cvo.tlOBCatch = false;
          cvo.tcbatch = recvo.lc_batch;
          cvo.tcseq = 'false';
          cvo.tcSupresFullPalWgt = recvo.plUnmatchedAsnQty;

          if (!recvo.llQuickrcv) {
            if (receivePlatformType) {
              recvo.curOper = ReceivingState.MARK_PALLET_TYPE;
              await this.cacheService.setcache(fwho, RECEIVING, recvo);
            } else {
              markResult = await this.processPallHist(fwho, recvo, constant);
            }
          } else {
            recvo.curOper = ReceivingState.QUICK_RECV_AFTER_CATCH_WGT;
            // markResult = await this.processPallHistQuickRec(fwho, recvo);
          }
          if (
            ((customer && customer[0]?.InboundPalletLabel?.trim()) ||
              recvo.plUsedF8) &&
            body.sndPal &&
            ['Y', ''].includes(body.sndPal.trim().toUpperCase())
          ) {
            recvo.curOper = ReceivingState.MARK_BELT_PRINTER;
            footerData = `${!recvo.plUsedF8 ? constant.F2_SKIP.trim() : ''}`;
            scrnUI.push(...this.printerSummary(recvo));
          }
          await this.cacheService.set2Obj(
            fwho,
            RECEIVING,
            recvo,
            'CATCHWEIGHT',
            cvo,
          );
          infoMsg = 'CATCHWEIGHT';
        }
      } else if (receivePlatformType) {
        recvo.curOper = ReceivingState.MARK_PALLET_TYPE;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
      } else {
        markResult = await this.processPallHist(fwho, recvo, constant);
      }
    } else {
      await this.ZERO(recvo);
      warnMsg = constant.PALLET_CANCELLED;
      if (receivePlatformType) {
        recvo.curOper = ReceivingState.MARK_PALLET_TYPE;
      } else {
        markResult = await this.processPallHist(fwho, recvo, constant);
      }
      await this.cacheService.setcache(fwho, RECEIVING, recvo);
    }

    this.logger.debug('receiving -->', `${markResult}, ${recvo.curOper}`);
    if (recvo.curOper !== ReceivingState.MARK_BELT_PRINTER) {
      recvo.curOper =
        markResult?.trim().length > 0 ? markResult : recvo.curOper;
    }

    if (
      infoMsg !== 'CATCHWEIGHT' &&
      errMsg !== constant.WEIGHTS_SYS &&
      recvo.llQuickrcv
    ) {
      const result = await this.QUICKOUT(fwho, recvo, constant, warnMsg);
      if (recvo.curOper === ReceivingState.MARK_PROCESS_PALLET) {
        recvo.lc_pal = '';
        recvo.QuickReciverDone = false;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
      }
      return result;
    }
    if (recvo.lc_isblast !== 'Y' && errMsg !== constant.WEIGHTS_SYS) {
      await this.SEEIFXDOCK(recvo);
    }

    this.logger.debug(
      `receiving --> INCREATE | End time ${moment().format(
        'HH:mm:ss-SSS',
      )} |  ${fwho} | ${recvo.curOper}`,
      ReceivingService.name,
    );
    this.logger.debug(
      `receiving --> INCREATE | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')} |  ${fwho} | ${
        recvo.curOper
      }`,
      ReceivingService.name,
    );
    if (recvo.curOper === ReceivingState.MARK_PROCESS_PALLET
      && recvo.lineageFreightManagement && ['L', 'D', 'S'].includes(recvo.quickRec?.fquickrcv?.trim())) {
      footerData = `${constant.F5_EXIT}`;
    } else if (recvo.curOper === ReceivingState.MARK_PROCESS_PALLET) {
      footerData = `${constant.F5_EXIT}~${constant.F8_LABL}`;
    }
    if (
      warnMsg === `${constant.LOT} ${recvo.lc_lot}` &&
      (infoMsg !== 'CATCHWEIGHT' ||
        recvo.curOper !== ReceivingState.MARK_BELT_PRINTER)
    ) {
      warnMsg = `${constant.LOT.trim()} ${recvo.lc_lot.trim()}`;
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg,
        infoMsg,
        warnMsg,
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
      '',
      '',
      footerData,
    );
  }

  //  Converts Date MMDDYYYY to a Julian Format YYYYDDD // rfjtod.prg
  RFDTOJ(ld_date: string): string {
    let lcj = '';
    const ldDate = ld_date.trim();
    if (ldDate.length === 8) {
      lcj = moment(ldDate, 'MMDDYYYY').format('YYYYDDD');
      if (lcj !== 'Invalid date') {
        lcj = lcj.slice(0, 4) + lcj.slice(4, 7).padStart(3, '0');
      }
    }
    if (lcj === 'Invalid date') {
      lcj = moment().format('MMDDYYYY');
    }
    return lcj;
  }

  // Converts Julian Date with Format YYYYDDD to Regular Date. MMDDYYYY* // RFJTOD.prg
  RFJTOD(ld_date: string): string {
    let lcj = '';
    const ldDate = ld_date.trim();
    if (ldDate.length === 7) {
      lcj = moment(ldDate, 'YYYYDDD').format('MMDDYYYY');
    }
    if (lcj === 'Invalid date') {
      lcj = moment().format('MMDDYYYY');
    }
    return lcj;
  }

  // Converts Julian Date with Format YYYYDDD to Regular Date. MMDDYYYY* // RFJTOD.prg
  RFJTODate(ld_date: string): string {
    let lcj = '';
    const ldDate = ld_date.trim();
    if (ldDate.length === 7) {
      lcj = moment(ldDate, 'YYYYDDD').format('YYYY-MM-DD');
    }
    if (lcj === 'Invalid date') {
      lcj = moment().format('YYYY-MM-DD');
    }
    return lcj;
  }

  // Wrapper for call to Dynamic Slotting API, parsing results, and updating PHY_MST.FPERRANK  // rfdynamicslottingapi.prg
  async RFDynamicSlottingApi(tcTrack: string, tcSerial: string) {
    if (
      tcTrack &&
      tcTrack.trim().length > 0 &&
      tcSerial &&
      tcSerial.trim().length > 0
    ) {
      const InboundData = await this.storedProceduresNewService.getWebapidynamicslottingdata(
        {
          inBatch: '',
          inSerial: tcSerial,
          inTrack: tcTrack,
        },
      );
      const item: any = InboundData;
      this.logger.debug(
        `receiving --> InboundData --> ${InboundData?.output}`,
        ReceivingService.name,
      );
      let pcXml: string = '';
      if (item && item?.recordset[0]) {
        const i = item?.recordset[0];
        pcXml =
          `<?xml version = "1.0" encoding="Windows-1252" standalone="yes"?>` +
          `<VFPData>
          <inbound>
            <lpn>${i.lpn.trim()}</lpn>
            <facility_id>${i.Facility_ID}</facility_id>
            <sku>${i.SKU.trim()}</sku>
            <case_quantitiy>${i.Case_Quantitiy}</case_quantitiy>
            <product_group>${i.Product_Group}</product_group>
            <item_description>${i.Item_Description.trim()}</item_description>
            <customer_name>${i.Customer_Name.trim()}</customer_name>
            <customer_code>${i.Customer_Code.trim()}</customer_code>
            <primary_from>${i.Primary_From}</primary_from>
            <primary_to>${i.Primary_To}</primary_to>
          </inbound>
        </VFPData>`;
      }
      let pcApiResult: string = 'null';
      if (pcXml && pcXml.length > 0) {
        try {
          const result = await this.httpService
            .post(`${gcDynamicSlottingWebApiUrl}`, pcXml, {
              headers: {
                'Content-Type': 'application/xml',
              },
            })
            .pipe()
            .toPromise();
          if (
            result &&
            result.data &&
            result.data.trim().length > 0 &&
            result.data.trim !== 'null'
          ) {
            pcApiResult = result.data.trim();
          }
        } catch (error) {
          this.logger.error(
            { error, message: 'SlottingWebApi error -->' },
            'Error in SlottingWebApi',
            ReceivingService.name,
          );
        }
      }

      await this.storedProceduresNewService.getWebapidynamicslottingresults({
        inBatch: '',
        inIsverbose: '',
        inSerial: tcSerial,
        inTrack: tcTrack,
        inXml: pcApiResult && pcApiResult.trim().length > 0 ? pcApiResult : '',
      });
    }
  }

  async getPalletMenu(): Promise<FieldItem[]> {
    let result: FieldItem[] = [];
    const query = await this.facilityService
      .getConnection()
      .createEntityManager()
      .query(
        `select CAST(RowNumber AS varchar) as value, FSHORT as rawID, FLONG as label from dbo.ufn_Platform_Menu_List() order by RowNumber;`,
      );
    if (query && query?.length > 0) {
      result = (query as unknown) as FieldItem[];
    }
    return result;
  }

  async InmanPalletTypeIngestion(
    recvo: ReceivingVO,
    pcPid: string,
    fshort: string,
  ): Promise<boolean> {
    let result = false;
    const CONFIG = (recvo.CONFIG as unknown) as Config;
    if (CONFIG && CONFIG?.receivePlatformType) {
      result = CONFIG.receivePlatformType;
    }
    if (result) {
      if (pcPid && pcPid.length > 0 && fshort && fshort.length > 0) {
        const palletMenu = await this.getPalletMenu();
        const palletCheck = palletMenu.filter(
          (item: FieldItem) => item.rawID === fshort,
        );
        if (palletMenu && palletCheck && palletCheck.length > 0) {
          await this.storedProceduresNewService.getInmanPlatformManualUpdate({
            inCarriernumber: pcPid.padEnd(20, ''),
            inPalltype: fshort,
          });
          result = true;
        } else {
          result = false;
        }
      } else {
        result = false;
      }
    } else {
      result = true;
    }
    return result;
  }

  async UpDteLoc(inFlocation: string) {
    if (inFlocation && inFlocation.length > 0) {
      await this.storedProceduresNewService.getActualizeLocation({
        inFlocation,
      });
    }
  }

  async CheckForStackable(inBatch: string, inPid: string): Promise<boolean> {
    let llReturn = false;
    if (inBatch && inBatch.length > 0 && inPid && inPid.length > 0) {
      const result = await this.storedProceduresNewService.getCheckforinboundstackable(
        {
          inBatch,
          inPid,
          outPass: '',
        },
      );
      if (result && result.output && result.output.out_pass) {
        llReturn = true;
      }
    }
    return llReturn;
  }

  summary2(recvo: ReceivingVO): any[] {
    const scrnUi = [];
    // const palletID = getObjFields('palletID');
    // palletID.defaultVal = recvo.lc_pal;
    // palletID.value = recvo.lc_pal;]

    const tie = getObjFields('ti');
    tie.defaultVal = recvo.ln_intie.toString();
    tie.value = recvo.ln_intie.toString();

    const length = getObjFields('lngth');
    length.defaultVal = recvo.pnLength.toString();
    length.value = recvo.pnLength.toString();

    const width = getObjFields('width');
    width.defaultVal = recvo.pnWidth.toString();
    width.value = recvo.pnWidth.toString();

    const height = getObjFields('height');
    height.defaultVal = recvo.pnHeight.toString();
    height.value = recvo.pnHeight.toString();

    scrnUi.push(tie, length, width, height);

    return scrnUi;
  }

  printerSummary(recvo: ReceivingVO): any[] {
    const scrnUi = [];
    const printerNum = getObjFields('printerNum');
    printerNum.defaultVal = recvo.printerDefault;
    printerNum.value = recvo.printerDefault;

    const verifyPID = getObjFields('verifyPID');

    const PIDLabel = getObjFields('PIDLabel');
    PIDLabel.defaultVal = recvo.pcPalletToCheck;
    PIDLabel.value = recvo.verifyPID;

    scrnUi.push(printerNum, PIDLabel, verifyPID);

    return scrnUi;
  }

  summary(recvo: ReceivingVO): Summary[] {
    const s = [];
    s.push({
      label: getLabelFields('batch-number'),
      rawID: 'batch-number',
      value: recvo.lc_batch,
    });
    s.push({
      label: getLabelFields('palletID'),
      rawID: 'palletID',
      value: recvo.lc_pal,
    });
    if (recvo.lc_hascust === 'Y') {
      s.push({
        label: getLabelFields('custPalletID'),
        rawID: 'custPalletID',
        value: recvo.lc_custpal,
      });
    }
    s.push(
      {
        label: getLabelFields('product'),
        rawID: 'product',
        value: recvo.lc_prod,
      },
      {
        label: getLabelFields(
          recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate',
        ),
        rawID: recvo.lc_dtetyp === 'J' ? 'julinDate' : 'codeDate',
        value: recvo.lc_dte,
        displayFormat: recvo.lc_dtetyp === 'J' ? 'julian' : 'date',
      },
      {
        label: getLabelFields('qty'),
        rawID: 'qty',
        value: recvo.lc_qty,
      },
    );
    if (!recvo.ll_usedF6 && recvo.ll_isHPPin) {
      s.push({
        label: getLabelFields('hpp'),
        rawID: 'hpp',
        value: recvo.lc_isHPP,
      });
    } else {
      s.push({
        label: getLabelFields('blast'),
        rawID: 'blast',
        value: recvo.lc_isblast1,
      });
    }
    if (recvo.lc_keylot === 'Y') {
      s.push({
        label: getLabelFields('lot'),
        rawID: 'lot',
        value: recvo.lc_lot,
      });
    }
    if (recvo.lc_haslot === 'Y') {
      s.push({
        label: getLabelFields('clot'),
        rawID: 'clot',
        value: recvo.lc_clot,
      });
    }
    if (recvo.lc_keyestb === 'Y') {
      s.push({
        label: getLabelFields('estb'),
        rawID: 'estb',
        value: recvo.lc_estb,
      });
    }
    if (recvo.lc_keyestb === 'Y' && !recvo.ll_usedF6) {
      s.push({
        label: getLabelFields('slaughDate'),
        rawID: 'slaughDate',
        value: recvo.lc_slaughdte,
        displayFormat: recvo.lc_slaughdte?.length === 7 ? 'julian' : 'date',
      });
    }
    if (recvo.lc_keyref === 'Y' && !recvo.ll_usedF6) {
      s.push({
        label: getLabelFields('ref'),
        rawID: 'ref',
        value: recvo.lc_ref,
      });
    }
    if (recvo.lc_keytmp === 'Y' && !recvo.ll_usedF6) {
      s.push({
        label: getLabelFields('temp'),
        rawID: 'temp',
        value: recvo.lc_temp,
        displayFormat: 'temp',
      });
    }
    if (recvo.lc_bbdtetype.trim() !== '' && !recvo.ll_usedF6) {
      const displayFormat = recvo.lc_bbdtetype === '1' ? 'julian' : 'date';
      s.push({
        label:
          recvo.lc_bbdtetype === '1'
            ? getLabelFields('bbjDte')
            : getLabelFields('bbcDte'),
        rawID: recvo.lc_bbdtetype === '1' ? 'bbjDte' : 'bbcDte',
        value: recvo.lc_bbdtetype === '1' ? recvo.lc_BBJULIAN : recvo.lc_bbdte,
        displayFormat,
      });
    }
    if (recvo.ll_isConsCross) {
      s.push({
        label: getLabelFields('consig'),
        rawID: 'consig',
        value: recvo.lcConscode,
      });
    }
    return s;
  }

  /** date function
   * Punit Kumar
   * 31-08-2023
   */
  fctID_CTOC(ld_date: string, glInternationalDate: boolean): string {
    let lcj = '';
    const lcDte = ld_date.trim();
    lcj = glInternationalDate
      ? moment(lcDte).format('DDMMYYYY')
      : moment(lcDte).format('MMDDYYYY');
    if (lcj === 'Invalid date') {
      lcj = moment().format(glInternationalDate ? 'DDMMYYYY' : 'MMDDYYYY');
    }
    return lcj;
  }

  fctID_CTOD(ld_date: string, glInternationalDate: boolean): string {
    //  && INPUT MMDDYY MMDDYYYY
    let lcj = '';
    let lcDte = ld_date.trim();
    if (lcDte.trim().length === 6) {
      lcDte = `${Number(lcDte.slice(4, 6)) < 96 ? '20' : '19'}${lcDte.slice(
        4,
        6,
      )}`;
    }
    lcj = glInternationalDate
      ? moment(lcDte).format('DD/MM/YYYY')
      : moment(lcDte).format('MM/DD/YYYY');
    if (lcj === 'Invalid date') {
      lcj = moment().format(glInternationalDate ? 'DD/MM/YYYY' : 'MM/DD/YYYY');
    }
    return lcj;
  }

  fctID_DTOS(ld_date: string, glInternationalDate: boolean): string {
    let lcj = '';
    const lcDte = ld_date.trim();
    lcj = glInternationalDate
      ? moment(lcDte).format('DDMMYYYY')
      : moment(lcDte).format('MMDDYYYY');
    if (lcj === 'Invalid date') {
      lcj = moment().format(glInternationalDate ? 'DDMMYYYY' : 'MMDDYYYY');
    }
    return lcj;
  }

  /**
   * Author - Punit Kumar
   */
  async quickReceiverAfterCatchWgt(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    let receivePlatformType = false;
    const CONFIG = (recvo.CONFIG as unknown) as Config;
    if (CONFIG && CONFIG?.receivePlatformType) {
      receivePlatformType = CONFIG.receivePlatformType;
    }
    if (receivePlatformType) {
      recvo.curOper = ReceivingState.MARK_PALLET_TYPE;
    } else {
      await this.processPallHistQuickRec(fwho, recvo);
      let CheckForStackable = false;
      if (await this.CheckForStackable(recvo.lc_batch, recvo.lc_pal)) {
        recvo.curOper = ReceivingState.MARK_PROCESS_GET_MOD;
        CheckForStackable = true;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        // result = recvo.curOper;
        // return result;
      }

      if (recvo.allowReceiverPutAway && !CheckForStackable) {
        recvo.pcPutAway = 'N';
        recvo.curOper = ReceivingState.MARK_PROCESS_PUT_AWAY;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
        // result = recvo.curOper;
        // return result;
      }
      if (
        recvo.curOper !== ReceivingState.MARK_PROCESS_GET_MOD &&
        recvo.curOper !== ReceivingState.MARK_PROCESS_PUT_AWAY
      ) {
        await this.processLastPallet(fwho, recvo, constant);
      }
    }

    if (recvo.llQuickrcv) {
      const result = await this.QUICKOUT(fwho, recvo, constant, '');
      if (recvo.curOper === ReceivingState.MARK_PROCESS_PALLET) {
        recvo.lc_pal = '';
        recvo.QuickReciverDone = false;
        await this.cacheService.setcache(fwho, RECEIVING, recvo);
      }
      return result;
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        curOper: recvo.curOper,
        errMsg: '',
        infoMsg: '',
        warnMsg: '',
      }),
      getOutFieldState(recvo.curOper),
    );
  }

  /**
   * Author - Punit Kumar
   */
  async processMachineId(
    fwho: string,
    recvo: ReceivingVO,
    body: PostRequestReceivingDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    const scrnUI = [];
    const validatemcDTO = await this.storedProceduresNewService.Validatemachine(
      {
        inEquipment: body.eqId,
        inModule: '',
        inType: 'MAIN',
        inUser: fwho,
        outMessage: '',
      },
    );
    let errMsg = '';
    let data: string = '';
    const validateOutMessage = (validatemcDTO.output as unknown) as ValidateDTO;
    if (validateOutMessage && validateOutMessage?.out_message) {
      data = validateOutMessage?.out_message.trim();
      // eslint-disable-next-line default-case
      switch (data) {
        case 'NOT VALID MACHINE': {
          data = constant.NOT_VALID_MACHINE;

          break;
        }
        case 'NOT MOLE TRAINED': {
          data = constant.NOT_MOLE_TRAINED;

          break;
        }
        case 'SCAN AIR TYPE EQ': {
          data = constant.SCAN_AIR_TYPE_EQ;

          break;
        }
        case 'SCAN FLOOR TYPE EQ': {
          data = constant.SCAN_FLOOR_TYPE_EQ;

          break;
        }
        // No default
      }
    }
    if (
      data &&
      data.length > 0 &&
      data
        .toString()
        .trim()
        .toUpperCase() === 'PASS'
    ) {
      // const AUTHRIZE = await this.authrizeRepos().findOne({
      //   finitials: fwho,
      // });
      const AUTHRIZE = await this.manager().query(
        `Select top 1 id from Authrize where finitials = '${fwho}'`,
      );
      let userData: any;
      if (AUTHRIZE.length > 0) {
        // await this.authrizeRepos().save(AUTHRIZE);
        await this.manager().query(
          `UPDATE Authrize SET fmhe = '${body.eqId}',  ZONE = '' where finitials = '${fwho}'`,
        );
        userData = await this.cacheService.getUserData(fwho);
        userData.pcMachineID = body.eqId;
        userData.userID = fwho;
        await this.cacheService.setUserData(fwho, userData);
        recvo.curOper = ReceivingState.MARK_PROCESS_PALLET;
        const d = getFields(ReceivingState.MARK_PROCESS_PALLET);
        if (recvo.RFREQ && recvo.RFREQ.fscanlngth)
          d.maxFieldLen = recvo.RFREQ.fscanlngth;
        scrnUI.push(d);
        recvo.lcInMachineID = body.eqId;
        recvo.prevCurOper = '';
      }
      //       console.log('validate Machine called', userData.userID);
    } else if (data && data.length > 0) {
      errMsg = data.toString().trim();
    }

    await this.cacheService.setcache(fwho, RECEIVING, recvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseReceivingDTO, {
        errMsg,
        infoMsg: '',
        curOper: recvo.curOper,
        scrnUI,
      }),
      getOutFieldState(recvo.curOper),
    );
  }

  async skipPrinterScreen(
    fwho: string,
    recvo: ReceivingVO,
    body: PostRequestReceivingDTO,
    constant: any,
  ) {
    body.sndPal = 'Y';
    body.ti = body.ti ? body.ti : recvo.ln_intie;
    body.height = body.height ? body.height : recvo.pnHeight;
    body.width = body.width ? body.width : recvo.pnWidth;
    body.lngth = body.lngth ? body.lngth : recvo.pnLength;
    return await this.processSendPallet(fwho, body, recvo, constant);
  }
}
