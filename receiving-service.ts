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
          } 
