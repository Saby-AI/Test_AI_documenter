
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EntityManager, Repository } from 'typeorm';
import { plainToClass } from 'class-transformer';
import { isString } from 'class-validator';
import { Blststatus } from 'entities/Blststatus';
import { Code2 } from 'entities/Code2';
import { Config } from 'entities/Config';
import { Codelkup } from 'entities/Codelkup';
import { Downstack } from 'entities/Downstack';
import { EdiPal } from 'entities/EdiPal';
import { EdiLog } from 'entities/EdiLog';
import { PhyDet } from 'entities/PhyDet';
import { InvTrn } from 'entities/InvTrn';
import { InvMst } from 'entities/InvMst';
import { Loadin } from 'entities/Loadin';
import { Lmscan } from 'entities/Lmscan';
import { Pallhist } from 'entities/Pallhist';
import { PhyMst } from 'entities/PhyMst';
import { PhyTrn } from 'entities/PhyTrn';
import { Reqblast } from 'entities/Reqblast';
import { Rfreq } from 'entities/Rfreq';
import { Stage } from 'entities/Stage';
import { FacilityService } from 'modules/database/facility/facility.service';
import { StoredProceduresNewService } from 'modules/stored-procedures/stored-procedures-new.service';
import { APIExternalPostService } from 'modules/rfcommon/api-external-post/service';
import { ConnectRFCacheService } from 'modules/cache/cache.service';
import { CustomLogger } from 'modules/logger/custom.logger';
import { BaseService } from 'shared/baseModules/service';
import { ResponseKeysDTO } from 'shared/dtos/responsekeys.dto';
import { GlobalDTO } from 'shared/dtos/global.dto';
import { CatchWeightVO } from 'modules/catchweights/vos/catchWeightVo';
import { Field, Summary } from 'modules/formbuilder/_dtos/screen.interface';
import { FieldItem } from 'modules/formbuilder/_dtos/fielditem';
import { LoadingVO } from 'modules/outbound/loading/vos/loadingvo';
import { ValidateDTO } from 'modules/rfcommon/service';
import { FormBuilderService } from 'modules/formbuilder/service';
import { GlobalisationService } from 'modules/globalisation/service';
import {
  getFields,
  getOutFieldState,
  getLabelFields,
  getOutputFields,
  getOutputFieldsExit,
  getObjFields,
} from './getFields';
import { TruckReceiveEvent } from './vos/truckreceive.event';
import { PostRequestTruckReceiveDTO } from './dtos/post.request.dto';
import { PostResponseTruckReceiveDTO } from './dtos/post.response.dto';
import { TruckReceiveState } from './truckreceive.enum';
import { TruckReceiveVO } from './vos/truckreceivevo';
import { Code2Obj } from './vos/code2';
import { PoInfo } from './vos/poInfo';
import * as TRUCKRECEIVEGUI from 'modules/formbuilder/_fields/INBOUNDTRUCK.json';
import { BeltPrinterService } from 'modules/common/beltprinter.service';
import { ModuleNameEnum } from 'enums/module.enum';
import { ValidateMaskDefinitionService } from 'modules/common/validateMaskDefinition';
import { MaskingTypeEnum } from 'enums/MaskingTypeEnum';
import { DynamicAttributesService } from 'modules/rfcommon/dynamic-attribute/dynamic-attr-service';
import { Iconfirm } from 'entities/Iconfirm';
import { LoadingState } from 'modules/outbound/loading/loading.enum';

const moment = require('moment');
const lodash = require('lodash');


const { gcDynamicSlottingWebApiUrl } = (global as unknown) as GlobalDTO;

const TRUCKRECEIVE: string = 'TRUCKRECEIVE';

const OBLOADING: string = 'OBLOADING';

@Injectable()
export class TruckReceiveService extends BaseService {
  constructor(
    @InjectRepository(PhyMst)
    private phymstRepo: () => Repository<PhyMst>,
    @InjectRepository(EdiPal)
    private editPAlRepo: () => Repository<EdiPal>,
    @InjectRepository(Blststatus)
    private blststatusRepo: () => Repository<Blststatus>,
    @InjectRepository(EdiLog)
    private edilogRepo: () => Repository<EdiLog>,
    @InjectRepository(Reqblast)
    private reqblastRepo: () => Repository<Reqblast>,
    @InjectRepository(InvMst)
    private invMstRepo: () => Repository<InvMst>,
    @InjectRepository(Stage)
    private stageRepo: () => Repository<Stage>,
    @InjectRepository(Pallhist)
    private pallhistRepo: () => Repository<Pallhist>,
    @InjectRepository(Lmscan)
    private lmscanRepo: () => Repository<Lmscan>,
    @InjectEntityManager()
    private manager: () => EntityManager,
    private eventEmitter: EventEmitter2,
    private httpService: HttpService,
    private readonly cacheService: ConnectRFCacheService,
    private readonly storedProceduresNewService: StoredProceduresNewService,
    private readonly apiExternalPostService: APIExternalPostService,
    private facilityService: FacilityService,
    private formBuilderService: FormBuilderService,
    private globalizationService: GlobalisationService,
    private validateMaskDefinitionService: ValidateMaskDefinitionService,
    private beltPrinterservice: BeltPrinterService,
    private logger: CustomLogger,
    private dynamicAttributesService: DynamicAttributesService,
    private readonly storedProcedureService: StoredProceduresNewService,
  ) {
    super();
    this.facilityService.injectRepos(this);
  }

  async executeTruckReceive(
    fwho: string,
    pcMachineID: string,
    body: PostRequestTruckReceiveDTO,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    await this.formBuilderService.allFieldsByFdbf('INBOUNDTRUCK', fwho);
    const constant = await this.globalizationService.applyModuleConst(
      fwho,
      'INBOUNDTRUCK',
    );

    let truckvo = new TruckReceiveVO();
    truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
    const cacheResults: unknown = await this.cacheService.getCache(fwho);
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.TRUCKRECEIVE) {
        truckvo = obj.TRUCKRECEIVE as TruckReceiveVO;
      } else {
        truckvo = new TruckReceiveVO();
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
      }
    } else {
      truckvo = new TruckReceiveVO();
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
    }
    truckvo.pcMachineID = pcMachineID; // punit made changes for quick-receive
    truckvo.fwho = fwho;
    this.logger.debug(
      {
        fwho,
        startTime: `${moment().format('HH:mm:ss-SSS')}`,
        payLoad: body,
      },
      `Execute > executeTruckReceive  > ${truckvo.curOper}`,
    );

    let result;
    if (body.pnInput && body.pnInput.toUpperCase() === 'F5') {
      return this.processExit(fwho, truckvo, constant);
    }

    switch (truckvo.curOper) {
      case TruckReceiveState.MARK_RECEIVING_CLOSE: {
        result = this.processClose(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_RECEIVING_CLOSE_AR: {
        result = this.processCloseAR(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_RECEIVING_CLOSE_P:
      case TruckReceiveState.MARK_RECEIVING_CLOSE_REC: {
        result = this.processCloseRec(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_RECEIVING_CLOSE_W: {
        result = this.processCloseWP(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_RECEIVING_EXIT: {
        result = this.processExit(fwho, truckvo, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_CONFIRMATION: {
        result = this.processConfirmationNo(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_PROD: {
        result = this.proccessInboundTruckGetProduct(
          fwho,
          truckvo,
          body,
          constant,
        );
        break;
      }
      case TruckReceiveState.MARK_SHOW_NOTES:
      case TruckReceiveState.MARK_PROCESS_PO_NUMBER: {
        result = await this.checkPalletNavigation(
          fwho,
          truckvo,
          body,
          constant,
        );
        break;
      }
      // case TruckReceiveState.MARK_PROCESS_PALLET: {
      //   result = this.processPalletID(fwho, truckvo, body, constant);
      //   break;
      // }
      case TruckReceiveState.MARK_PROCESS_PALLET: {
        result = this.processPalletIDPrinter(fwho, body, truckvo, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_PALLET_RESCAN: {
        result = this.processRescanPal(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_CUST_PALLET: {
        result = this.processCustPal(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_DATE: {
        result = this.SCANDATE(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_QTY:
      case TruckReceiveState.MARK_PROCESS_QTY_YN: {
        result = this.processQty(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_BLAST: {
        result = this.processBlast(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_LOT: {
        result = this.processLotNo(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_CLOT: {
        result = this.processCustLotNo(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_EST: {
        result = this.processEST(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_SDATE: {
        result = this.processSDate(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_REF: {
        result = this.processRef(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_TEMP: {
        result = this.processTemp(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_BB_JDATE:
      case TruckReceiveState.MARK_PROCESS_BB_DATE: {
        result = this.processBBdate(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_CONSIGNEE: {
        result = this.processConsignee(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_SEND_PALLET: {
        result = await this.processSendPallet(fwho, truckvo, body, constant);
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        break;
      }
      case TruckReceiveState.MARK_PALLET_TYPE: {
        result = this.processPalletType(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_GET_MOD: {
        result = this.GetModPallet(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_MOD_PAL: {
        result = this.processGetModPallet(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PROCESS_PUT_AWAY: {
        result = this.processPutAway(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_PALLET_MERGE: {
        result = this.processPalletMerge(fwho, truckvo, body);
        break;
      }
      case TruckReceiveState.MARK_RECEIVING_GETMACHINEID: {
        result = this.processMachineId(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.QUICK_RECV_AFTER_CATCH_WGT: {
        result = this.quickReceiverAfterCatchWgt(fwho, truckvo, constant);
        break;
      }
      case TruckReceiveState.MARK_CHANGE_CODE_DATE: {
        result = this.changeCodeDate(fwho, truckvo, body, constant);
        break;
      }
      case TruckReceiveState.MARK_BELT_PRINTER: {
        const cacheResults: unknown = await this.cacheService.getCache(fwho);
        if (cacheResults && cacheResults !== '') {
          const obj = JSON.parse(cacheResults as string);
          if (obj && obj.TRUCKRECEIVE) {
            truckvo = obj.TRUCKRECEIVE as TruckReceiveVO;
          }
        }
        truckvo.redirectOnSuccess = 'processSendPallet';
        result = await this.beltPrinterservice.processPrinter<
          PostRequestTruckReceiveDTO,
          TruckReceiveVO
        >(
          fwho,
          body,
          truckvo,
          constant,
          ModuleNameEnum.TRUCK_RECEIVE,
          { fwho, truckreceiveBody: body },
          this,
        );
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        break;
      }
      case TruckReceiveState.MARK_VERIFY_PALLET: {
        result = await this.beltPrinterservice.verifyPallet<
          PostRequestTruckReceiveDTO,
          TruckReceiveVO
        >(
          fwho,
          body,
          truckvo,
          constant,
          ModuleNameEnum.TRUCK_RECEIVE,
          { fwho, truckreceiveBody: body },
          this,
        );
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        break;
      }
      case TruckReceiveState.MARK_PALLET_INFO_MSG: {
        result = await this.driveToScanLocation(fwho, body, truckvo, constant);
        break;
      }
      case TruckReceiveState.MARK_PALLET_INFO_MSG_CW: {
        result = await this.infoMessageScreen(fwho, body, truckvo, constant);
        break;
      }
      case TruckReceiveState.MARK_PALLET_SCAN_LOCATION: {
        result = await this.updatePhyMstAndStageLocations(
          fwho,
          body,
          truckvo,
          constant,
        );
        break;
      }
      case TruckReceiveState.MARK_INVCONTROL_SCREEN: {
        result = await this.updateInvControl(fwho, body, truckvo, constant);
        break;
      }
      case TruckReceiveState.MARK_XDOCK_AUTO_RECEIVE: {
        result = await this.autoReceiveXdock(fwho, truckvo, constant);
        break;
      }
      default: {
        result = new ResponseKeysDTO(
          plainToClass(PostResponseTruckReceiveDTO, {
            errMsg: 'Invalid MARK Operation Error',
            infoMsg: '',
            curOper: truckvo.curOper,
          }),
        );
        break;
      }
    }

    return result;
  }

  async processExit(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    // line 2189 - && see if pallet needs to be deleted if cancelled
    // const perMsg = (truckvo.dynBat === '' || truckvo.lc_mergepal !== 'Y') ? await this.performanceService.execute(fwho) : undefined;
    const truckvo = truckVo;
    let infoMsg = '';
    const scrnUI: any = [];

    // if it's pono screen,send marker for prod scrn
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PO_NUMBER) {
      const checkXdock = await this.checkCrossDock(fwho, truckvo, constant);

      if (
        truckvo.quickRec &&
        ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv) &&
        !checkXdock?.length
      ) {
        return this.processNavigateToPalletIdScreen(
          fwho,
          truckvo.LOADIN?.fconfirmnm,
          truckvo,
          constant,
        );
      }
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.avoidable = false;
      prodField.hideUntilEnabled = false;
      scrnUI.push(prodField);

      const confirmField = getFields(
        TruckReceiveState.MARK_PROCESS_CONFIRMATION,
      );
      confirmField.avoidable = true;
      scrnUI.push(confirmField);

      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          errMsg: '',
          infoMsg: '',
          curOper: truckvo.curOper,
          scrnUI,
        }),
        getOutputFields('conprod'),
        '',
        '',
        `${constant.F5_EXIT.trim()}`,
      );
    }

    if (
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_MOD_PAL ||
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_GET_MOD
    ) {
      const config = (truckvo.CONFIG as unknown) as Config;
      const glPutDuringRec = config ? config.putAwayDuringReceiving : false;
      if (glPutDuringRec) {
        truckvo.pcPutAway = 'N';
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PUT_AWAY;

        const putwayField = getFields(TruckReceiveState.MARK_PROCESS_PUT_AWAY); // PUT PALLET AWAY Y/N
        scrnUI.push(putwayField);

        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        return new ResponseKeysDTO(
          plainToClass(PostResponseTruckReceiveDTO, {
            errMsg: '',
            infoMsg,
            curOper: truckvo.curOper,
            scrnUI,
          }),
          getOutFieldState(truckvo.curOper),
        );
      }
      return this.processLastPallet(fwho, truckvo, constant);
    }
    truckvo.curOper = TruckReceiveState.MARK_RECEIVING_EXIT;

    if (
      truckvo.pcConfirmationNumber &&
      truckvo.pcConfirmationNumber.trim().length > 0
    ) {
      if (truckvo.lcPal && truckvo.lcPal.length > 0) {
        infoMsg = constant.DATA_NOT_SENT.trim();
        await this.manager().query(
          `BEGIN
              Declare @lc_pal char(20), @checkExistID int;
              SET @lc_pal = '${truckvo.lcPal}'
              SELECT @checkExistID =  id FROM dbo.PHY_MST WHERE FPALLETID  = @lc_pal and FQTY = 0 and SUBSTRING(FTRACK,8,10) = '   ';
              IF @checkExistID > 0
              BEGIN
                DELETE FROM [dbo].[PHY_MST] WHERE [ID] = @checkExistID;
              END
          END`,
        );
      }
      truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE;

      const LOADINresult = await this.manager().query(
        `BEGIN SELECT id, trim(fscanstat) fscanstat FROM dbo.Loadin WHERE fbatch = '${truckvo.lcBatch}' order by fbatch ASC ; END`,
      );
      const LOADIN: Loadin = LOADINresult[0];
      if (LOADIN && LOADIN.fscanstat) {
        truckvo.pcMultiRecScanStat = LOADIN.fscanstat;
      }
      if (
        truckvo.plMultiReceiver &&
        truckvo.pcMultiRecScanStat === 'R' &&
        truckvo.curOper !== TruckReceiveState.MARK_PROCESS_PROD
      ) {
        truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE_REC;
        const closePalRField = getFields(
          TruckReceiveState.MARK_RECEIVING_CLOSE_REC, // Batch Closed By Another Receiver
        );
        scrnUI.push(closePalRField);
      } else if (truckvo.plMultiReceiver === false) {
        truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE; // Close Batch
        const closeBatField = getFields(TruckReceiveState.MARK_RECEIVING_CLOSE);
        scrnUI.push(closeBatField);
      } else if (truckvo.pcMultiRecScanStat !== 'R') {
        truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE_AR; // Close Batch For All Receivers
        const closePalARField = getFields(
          TruckReceiveState.MARK_RECEIVING_CLOSE_AR,
        );
        scrnUI.push(closePalARField);
      }
      if (truckvo.prevCurOper === TruckReceiveState.MARK_SHOW_NOTES) {
        infoMsg = constant.DATA_NOT_SENT;
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    } else {
      infoMsg = 'RFINBOUNDMAINMENU';
      await this.cacheService.delete2Obj(fwho, TRUCKRECEIVE, 'CATCHWEIGHT');
      truckvo.curOper = TruckReceiveState.MARK_RECEIVING_EXIT;
      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          errMsg: '',
          infoMsg,
          curOper: truckvo.curOper,
          scrnUI,
        }),
        getOutputFieldsExit(TruckReceiveState.MARK_PROCESS_CONFIRMATION),
      );
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg,
        curOper: truckvo.curOper,
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
    );
  }

  async processCloseAR(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    let plPalletInWorking: boolean = false;
    const scrnUI = [];
    if (body.closePalAR && body.closePalAR.length > 0) {
      const [PHY_MST] = await this.manager().query(
        `SELECT plPalletInWorking = 1 FROM [dbo].[PHY_MST] [pm] JOIN
        [dbo].[LOADIN] li ON pm.FTRACK=[li].[FBATCH] + '   ' WHERE [li].[FCONFIRMNM]='${truckvo.pcConfirmationNumber}'`,
      );

      if (PHY_MST) {
        plPalletInWorking = true;
      }

      if (plPalletInWorking) {
        truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE_W;
        // Another Receiver Has A Pallet In Working Batch NOT Closed Press Enter
        const palWorking = getFields(TruckReceiveState.MARK_RECEIVING_CLOSE_W);
        scrnUI.push(palWorking);
        // INCLOSE should execute when the closePalAR = Y and record not found from phymst Query
      } else if (body?.closePalAR?.trim() === 'Y' && !plPalletInWorking) {
        // await this.INCLOSE(fwho, truckvo);
        setTimeout(this.tiggerINCLOSE, 500, fwho, truckvo, this);
        let machineId = '';
        if (truckvo && truckvo.llQuickrcv && truckvo.lcInMachineID) {
          machineId = truckvo.lcInMachineID;
          truckvo = new TruckReceiveVO();
          truckvo.lcInMachineID = machineId;
          truckvo.fwho = fwho;
        } else {
          truckvo = new TruckReceiveVO();
        }
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
      } else {
        let machineId = '';
        const { fquickrcv } = truckvo?.quickRec || {};

        if (
          fquickrcv?.trim() &&
          ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
        ) {
          if (truckvo && truckvo.llQuickrcv && truckvo.lcInMachineID) {
            machineId = truckvo.lcInMachineID;
            truckvo = new TruckReceiveVO();
            truckvo.lcInMachineID = machineId;
            truckvo.fwho = fwho;
          } else {
            truckvo = new TruckReceiveVO();
          }

          return await this.processNavigateToPalletIdScreen(
            fwho,
            truckVo.LOADIN?.fconfirmnm,
            truckVo,
            constant,
          );
        }

        // navigate to product
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
        const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
        prodField.avoidable = false;
        prodField.hideUntilEnabled = false;
        scrnUI.push(prodField);

        // footer = `${constant.F5_EXIT.trim()}`;
      }
      // } else {
      //   let machineId = '';
      //   if (truckvo && truckvo.llQuickrcv && truckvo.lcInMachineID) {
      //     machineId = truckvo.lcInMachineID;
      //     truckvo = new TruckReceiveVO();
      //     truckvo.lcInMachineID = machineId;
      //     truckvo.fwho = fwho;
      //   } else {
      //     truckvo = new TruckReceiveVO();
      //   }
      //   truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
    }
    await this.resetLoading(fwho);
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT.trim()}`,
    );
  }

  async processCloseWP(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    let value = '';
    if (body.closePalW && body.closePalW.length > 0) {
      value = body.closePalW;
    }
    if (value?.length > 0) {
      let machineId = '';
      if (truckvo && truckvo.llQuickrcv && truckvo.lcInMachineID) {
        machineId = truckvo.lcInMachineID;
        truckvo = new TruckReceiveVO();
        truckvo.lcInMachineID = machineId;
        truckvo.fwho = fwho;
      } else {
        truckvo = new TruckReceiveVO();
      }
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: truckvo.curOper,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT.trim()}`,
    );
  }

  async processCloseRec(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    if (
      (body.closePalR && body.closePalR.length > 0) ||
      (body.closePalP && body.closePalP.length > 0)
    ) {
      let machineId = '';
      if (truckvo && truckvo.llQuickrcv && truckvo.lcInMachineID) {
        machineId = truckvo.lcInMachineID;
        truckvo = new TruckReceiveVO();
        truckvo.lcInMachineID = machineId;
        truckvo.fwho = fwho;
      } else {
        truckvo = new TruckReceiveVO();
      }
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
      await this.resetLoading(fwho);
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: truckvo.curOper,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT.trim()}`,
    );
  }

  async processClose(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE;

    let infoMsg = '';

    // line 2242 - && see if pallet needs to be deleted if cancelled
    const scrnUI = [];
    let footer = '';
    let lcClose = '';
    if (body.closeBat && body.closeBat === 'Y') {
      lcClose = body.closeBat;
    }

    let additionalProps = {};
    if (lcClose.toUpperCase() === 'Y') {
      // await this.INCLOSE(fwho, truckvo); 
      setTimeout(this.tiggerINCLOSE, 500, fwho, truckvo, this);
      if (truckvo.dynBat && truckvo.dynBat !== '') {
        truckvo.lcMergePal = 'N';
        truckvo.curOper = TruckReceiveState.MARK_PALLET_MERGE;
        const merBatField = getFields(TruckReceiveState.MARK_PALLET_MERGE); // Merge Pallets For Batch
        scrnUI.push(merBatField);
      } else {
        let machineId = '';
        if (truckvo && truckvo.llQuickrcv && truckvo.lcInMachineID) {
          machineId = truckvo.lcInMachineID;
          truckvo = new TruckReceiveVO();
          truckvo.lcInMachineID = machineId;
          truckvo.fwho = fwho;
        } else {
          truckvo = new TruckReceiveVO();
        }
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
        footer = `${constant.F5_EXIT.trim()}`;
      }

      await this.resetLoading(fwho);
    } else {
      // truckvo.curOper =
      //   truckvo.prevCurOper === 'MARK_RECEIVING_GETMACHINEID'
      //     ? TruckReceiveState.MARK_RECEIVING_GETMACHINEID
      //     : TruckReceiveState.MARK_PROCESS_PROD;
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;

      if (truckvo.lcPal && truckvo.lcPal?.trim().length > 0) {
        infoMsg = constant.DATA_NOT_SENT.trim();
        truckvo.lcPal = '';
      }

      if (truckvo.prevCurOper === TruckReceiveState.MARK_SHOW_NOTES) {
        let notes;
        if (
          truckvo.LOADIN.fcustcode &&
          truckvo.LOADIN.fconsignor.trim() !== ''
        ) {
          // Get notes from stored procedure
          const spResult = await this.storedProcedureService.getRfShowcustomerconsigneenotes(
            {
              lcconsig: truckvo.LOADIN.fconsignor.trim().replace('/', ''),
              lccustomer: truckvo.LOADIN.fcustcode,
              lctype: 'RECV',
              lnheight: 4,
            },
          );
          // Get the first note from recordset with type checking
          const firstNote =
            typeof spResult?.recordset?.[0]?.NOTE === 'string'
              ? spResult.recordset[0].NOTE
              : '';
          // Create curNotes with just the note, removing any newline characters
          const curNotes = [
            {
              note: firstNote.replace(/\n/g, '').trim(),
            },
          ];
          // Properly access note from the array
          notes = curNotes[0]?.note || '';
        } else if (
          truckvo.LOADIN.fcustcode &&
          truckvo.LOADIN.fconsignor.trim() === ''
        ) {
          const [curNotes] = await this.manager().query(`BEGIN
          DECLARE @curNotes TABLE (FLINE int, NOTE varchar(38));
          INSERT INTO @curNotes EXEC [dbo].[usp_RF_ShowCustomerConsigneeNotes]
          @lcCustomer = '${truckvo.LOADIN.fcustcode}',
          @lcConsig = '',
          @lcType = 'RECV',
          @lnHeight  = 4;
          SELECT TOP 1 note FROM @curNotes;
          END`);
          notes = curNotes && curNotes.note ? curNotes.note : '';
        }
        if (
          !notes &&
          truckvo.quickRec &&
          truckvo.quickRec.fquickrcv?.trim().length > 0
        ) {
          const rcvType = truckvo.quickRec?.fquickrcv;
          const notesData: Record<string, string> = {
            L: constant.LEAVE_ON_TRUCK,
            D: constant.STORE_ON_DOCK,
            S: constant.STORE_IN_FREEZER,
          };
          const [loadresult] = await this.manager()
            .query(`SELECT TOP 1 im.FBATCH as fbatch, trim(ep.FPALLETID) as fpalletid,l.FDOOR as fdoor
            FROM dbo.EDI_PAL ep
            JOIN dbo.INV_MST im ON RIGHT(trim(ep.FPALLETID),16) = im.FLOT
            JOIN dbo.LOADOUT l  ON im.FBATCH = l.FBATCH
            WHERE ep.FBATCH = '${truckvo?.lcBatch}' AND im.FRECTYPE = 'C'`);
          if (
            loadresult &&
            loadresult.fbatch &&
            truckvo.quickRec.fquickrcv === 'D'
          ) {
            notes = `${constant.TAKE_TO_DOOR} ${loadresult.fdoor}`;
          }
          notes = notesData[rcvType] || '';
        }
        if (
          notes &&
          truckvo.quickRec &&
          truckvo.quickRec.fquickrcv?.trim() !== 'D'
        ) {
          truckvo.curOper = TruckReceiveState.MARK_SHOW_NOTES;
          additionalProps = {
            data: notes,
            label: 'Notes',
          };
        }
      }

      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD) {
        const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
        prodField.avoidable = false;
        prodField.hideUntilEnabled = false;
        scrnUI.push(prodField);

        footer = `${constant.F5_EXIT.trim()}`;
      }

      if (
        truckvo.prevCurOper !== TruckReceiveState.MARK_SHOW_NOTES &&
        ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
      ) {
        return await this.processNavigateToPalletIdScreen(
          fwho,
          truckVo.LOADIN?.fconfirmnm,
          truckVo,
          constant,
        );
      }
    }
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg,
        curOper: truckvo.curOper,
        scrnUI,
        ...additionalProps,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footer,
    );
  }

  async resetLoading(fwho: string): Promise<void> {
    let loadingvo: LoadingVO;
    loadingvo = new LoadingVO();

    const cacheResults: any = await this.cacheService.getCache(fwho);
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.OBLOADING) {
        loadingvo = obj.OBLOADING as LoadingVO;
      }
    }
    if (
      loadingvo.curOper &&
      loadingvo?.curOper !== LoadingState.MARK_PROCESS_PALLET
    ) {
      loadingvo = new LoadingVO();
      loadingvo.curOper = LoadingState.MARK_PROCESS_PALLET;
      await this.cacheService.setcache(fwho, OBLOADING, loadingvo);
    }
  }

  async processPalletMerge(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    let infoMsg;
    if (body.merBat && body.merBat.toUpperCase() === 'Y') {
      infoMsg = 'MergePallets';
    } else {
      truckvo = new TruckReceiveVO();
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg,
        curOper: truckvo.curOper,
      }),
      getOutFieldState(truckvo.curOper),
    );
  }

  async dpaINCLOSE(fwho: string) {
    let truckvo = new TruckReceiveVO();
    truckvo.curOper = TruckReceiveState.MARK_PROCESS_CONFIRMATION;
    const cacheResults: unknown = await this.cacheService.getCache(fwho);
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.TRUCKRECEIVE) {
        truckvo = obj.TRUCKRECEIVE as TruckReceiveVO;
      }
    }
    // await this.INCLOSE(fwho, truckvo);
    setTimeout(this.tiggerINCLOSE, 500, fwho, truckvo, this);
  }

  async tiggerINCLOSE(fwho: string, truckvo: TruckReceiveVO, _this: any) {
    await _this.INCLOSE(fwho, truckvo);
  }

  async INCLOSE(fwho: string, truckvo: TruckReceiveVO): Promise<void> {
    const startTime = moment();
    this.logger.debug(
      {
        fwho,
        startTime: `${moment().format('HH:mm:ss-SSS')}`,
        truckvo,
        curOper: truckvo.curOper,
      },
      `INCLOSE > BEGIN with ${truckvo.curOper}`,
    );

    const timeZoneIANA = this.facilityService.getWareHouseSettings().timeZoneIANA;

    await this.manager().query(
      `EXECUTE [dbo].[usp_mrs_inclose] @in_ConfirmationNumber = '${truckvo.pcConfirmationNumber}',@in_lc_init = '${fwho}', @out_response=''`,
    );

    await this.manager().query(
      `BEGIN UPDATE LOADIN SET FSCANSTAT = 'R' WHERE FCONFIRMNM = '${truckvo.pcConfirmationNumber}' END`,
    ); // wrapper to change the scanstat to all the batches in confirmation

    const [LOADIN] = await this.manager().query(
      `BEGIN
          SELECT
          id,foutbatch,fconfirmnm,fshipstat,
          CONVERT(varchar, ffinishdte, 23) as ffinishdte,
          CONVERT(varchar, fbdate, 23) as fbdate,
          ffinishtme
          FROM LOADIN
          WHERE FCONFIRMNM='${truckvo.pcConfirmationNumber}'
       END`,
    );

    if (LOADIN.fconfirmnm.trim().length > 0) {
      const [ICONFIRM] = await this.manager().query(
        `BEGIN
             SELECT
             id,ffinish,fmbol,flivedrop,reusetrailer
             FROM ICONFIRM
             WHERE FMBOL='${LOADIN.fconfirmnm}'
        END`,
      );

      let nextDay = '';
      if (LOADIN.fbdate && LOADIN.fconfirmnm.trim()) {
        nextDay = `${moment(LOADIN.fbdate).format('YYYYMMDD')}${LOADIN.fconfirmnm
          }`;
      }
      if (ICONFIRM && nextDay.trim().length > 0) {
        const d = LOADIN.ffinishdte
          ? LOADIN.ffinishdte
          : this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');

        const ltDtetmeStr = `${d} ${moment(LOADIN.ffinishtme, 'HHmm').format(
          'HH:mm',
        )}`;
        const ltDtetme =
          ltDtetmeStr?.trim()?.length > 0
            ? moment(ltDtetmeStr, 'YYYY-MM-DD HH:mm') // convert to moment obj
            : moment().tz(timeZoneIANA);

        const ffinishStr = ICONFIRM?.ffinish
          ? moment(ICONFIRM.ffinish, 'YYYY-MM-DD HH:mm:ss.SSS').format(
            'YYYY-MM-DD HH:mm',
          )
          : this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm');

        const iconfirmFFinish =
          ICONFIRM?.ffinish && ffinishStr?.trim()?.length > 0
            ? moment(ffinishStr, 'YYYY-MM-DD HH:mm') // convert to moment obj
            : moment().tz(timeZoneIANA);

        const result = (iconfirmFFinish.diff(ltDtetme) < 0
          ? ltDtetme
          : iconfirmFFinish
        ).format('YYYY-MM-DD HH:mm:ss.SSS');

        ICONFIRM.ffinish = result;
        
        this.logger.debug(
          { ltDtetme, LOADIN, ICONFIRM, iconfirmFFinish, result },
          'INCLOSE > Updating ICONFIRM',
        );
        await this.manager().query(
          `BEGIN
             UPDATE ICONFIRM set ffinish=@1 WHERE id=@0
           END`,
          [ICONFIRM.id, ICONFIRM.ffinish],
        );
        const loadinresult = await this.manager().query(
          `BEGIN
               SELECT
               foutbatch,fconfirmnm,fshipstat,ffinishdte,ffinishtme,id
               FROM LOADIN
               WHERE FCONFIRMNM='${ICONFIRM.fmbol}'
           END`,
        );

        loadinresult.forEach(async (LOADIN: Loadin) => {
          if (LOADIN.foutbatch.trim() !== '') {
            await this.OUTCLOSE(truckvo, LOADIN.foutbatch);
          }
          if (
            LOADIN.fconfirmnm === ICONFIRM.fmbol &&
            LOADIN.fshipstat !== 'Y'
          ) {
            const idate = ICONFIRM.ffinish
              ? moment(ICONFIRM.ffinish, 'YYYY-MM-DD HH:mm:ss.SSS')
              : null;
            LOADIN.ffinishdte =
              idate != null ? idate.format('YYYY-MM-DD') : null;
            LOADIN.ffinishtme = idate != null ? idate.format('HHmm') : '';

            this.logger.debug(
              { ICONFIRM, LOADIN },
              'INCLOSE > Updating LOADIN ffinishdte & ffinishtme',
            );

            await this.manager().query(
              `BEGIN
                   UPDATE LOADIN set ffinishdte=@1, ffinishtme=@2 WHERE id=@0
               END`,
              [LOADIN.id, LOADIN.ffinishdte, LOADIN.ffinishtme],
            );
          }
        });

        // ** Attempt to AutoReceive Confirmation **
        await this.storedProceduresNewService.getRfAutoreceiveinbound({
          batch: truckvo.lcBatch,
          userid: fwho,
        });

        if (ICONFIRM?.flivedrop === 'D' && ICONFIRM?.reusetrailer === false) {
          this.logger.debug(
            { ICONFIRM },
            'INCLOSE > Executing SP getYmsMoveToYard',
          );
          const result = await this.storedProceduresNewService.getYmsMoveToYard(
            {
              inConfirmationNumber: ICONFIRM.fmbol,
              outputJson: '',
            },
          );

          const pcJSON: string =
            result && result.output && result.output.output_json
              ? result.output.output_json.toString()
              : '';
          await this.apiExternalPostService.execute(
            fwho,
            'YMS',
            'MoveToYard',
            pcJSON,
          );
        }
      }
    }

    // if (truckvo.llQuickrcv) {
    //   await this.OUTCLOSE(truckvo);
    // }
    this.logger.debug(
      {
        service: TruckReceiveService.name,
        curOper: truckvo.curOper,
        fwho,
      },
      `Truck-receive --> INCLOSE | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')}`,
    );
  }

  async processConfirmationNo(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let tcDynamicBatch = '';
    truckvo.dynBat = '';
    if (body.dynBat && body.dynBat.length > 0) {
      tcDynamicBatch = body.dynBat;
      if (isString(tcDynamicBatch)) {
        tcDynamicBatch = tcDynamicBatch
          .toString()
          .trim()
          .padStart(7, '0');
      }
      truckvo.dynBat = tcDynamicBatch;
    }

    // let pcDynamicBatch: string = '';
    const configData = await this.manager().query(
      `SELECT id, InternationalDate, allowMultipleReceivers, fquickbatch, putAwayDuringReceiving, receivePlatformType, ofcputflag from Config;`,
    );
    const CONFIG = configData[0];
    truckvo.CONFIG = CONFIG;
    truckvo.interDate = CONFIG.InternationalDate;
    let plMultiReceiver: boolean = false;
    plMultiReceiver = CONFIG ? CONFIG.allowMultipleReceivers : plMultiReceiver;
    truckvo.plMultiReceiver = plMultiReceiver;

    let plDynamicRail: boolean = false;
    let pcGetLocType: string;
    if (truckvo.dynBat && truckvo.dynBat !== '') {
      const pcWorkingZone = '';
      if (pcWorkingZone.charAt(0) === 'R') {
        plDynamicRail = true;
        pcGetLocType = 'R';
        truckvo.pcGetLocType = pcGetLocType;
      } else {
        plDynamicRail = false;
      }
    }
    truckvo.plDynamicRail = plDynamicRail;

    truckvo.llYrFormatSet = false;

    if (truckvo.dynBat && truckvo.dynBat.length > 0) {
      let piDoorNumber = 0;
      const LOADINresult = await this.manager().query(
        `BEGIN SELECT id, fdoornum FROM dbo.Loadin WHERE fbatch = '${truckvo.dynBat}' order by fbatch ASC ; END`,
      );
      const loadin: Loadin = LOADINresult[0];
      if (loadin && loadin.fdoornum) {
        piDoorNumber = loadin.fdoornum;
      }

      const msg = `Door ${piDoorNumber
        .toString()
        .trim()
        .padStart(3, '0')}`;
      this.logger.debug(
        'truckreceive -->',
        `Door msg--> ${msg} Batch #${tcDynamicBatch}`,
      );
    }

    const pcConfirmationNumber = body.confirm;
    truckvo.pcConfirmationNumber = pcConfirmationNumber;
    const [truckconfirmation] = await this.manager().query(
      `DECLARE @msg varchar(2000) ;
            EXEC [dbo].[usp_mrs_InboundsByTruckStartup]
          @in_ConfirmationNumber = @0,
          @in_IsMultiReceiver = @1,
          @in_lc_init = @2,
          @out_response = @msg OUTPUT
          SELECT  'ReturnValue' = @msg`,
      [pcConfirmationNumber, plMultiReceiver, fwho],
    );

    truckvo.pcConfirmationNumber =
      truckconfirmation?.ReturnValue?.trim().length > 0
        ? ''
        : pcConfirmationNumber;
    if (truckconfirmation?.ReturnValue?.length > 0) {
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          curOper: truckvo.curOper,
          errMsg: truckconfirmation?.ReturnValue,
          infoMsg: '',
          infoMsg2: '',
          scrnUI: [],
        }),
        getOutputFields('confirm'),
        '',
        '',
        `${constant.F5_EXIT.trim()}`,
      );
    }

    const [loadin] = await this.manager().query(`BEGIN
      SELECT TOP 1 id,fbatch FROM LOADIN WHERE FCONFIRMNM = '${pcConfirmationNumber}' ORDER BY ID;
      END`);
    const [quickRec] = await this.manager().query(
      `SELECT TOP 1 TRIM(fquickrcv) as fquickrcv FROM QUICKREC WHERE FINBATCH = '${loadin?.fbatch}'`,
    );
    truckvo.quickRec = quickRec ? quickRec : {};
    if (
      quickRec &&
      quickRec.fquickrcv?.trim().length > 0 &&
      ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
    ) {
      return await this.processNavigateToPalletIdScreen(
        fwho,
        pcConfirmationNumber,
        truckVo,
        constant,
      );
    }
    truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

    const scrnUI = [];

    const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
    prodField.avoidable = false;
    scrnUI.push(prodField);

    const confirmField = getFields(TruckReceiveState.MARK_PROCESS_CONFIRMATION);
    confirmField.avoidable = true;
    scrnUI.push(confirmField);

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg: '',
        infoMsg: '',
        scrnUI,
      }),
      getOutputFields('conprod'),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async proccessInboundTruckGetProduct(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    truckvo.lcHasBox = 'N';
    truckvo.lcHasCust = 'N';
    truckvo.lcHasLot = 'N';
    truckvo.lcKeyLot = 'N';
    truckvo.lcKeyEstb = 'N';
    truckvo.lcKeyRef = 'N';
    truckvo.lcKeyTmp = 'N';
    truckvo.lcHasBlast = 'N';
    truckvo.lnOldTie = 0;
    truckvo.lnOldHigh = 0;

    truckvo.lcPal =
      truckvo.quickRec && ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
        ? truckvo.lcPal
        : '';
    truckvo.lcCustpal = '';
    truckvo.lcProd = '';
    truckvo.lcCoolCode = '';
    truckvo.lcDte = '';
    truckvo.lcJdte = '';
    truckvo.lcBbdte = '';
    truckvo.lcBBJULIAN = '';

    truckvo.lcQty = '';
    truckvo.plUnmatchedAsnQty = false;
    truckvo.pnExpectedAsnQty = 0;
    truckvo.lcLot = '';
    truckvo.lcClot = '';
    truckvo.lcEstb = '';
    truckvo.lcSlaughDte = '';
    truckvo.lcRef = '';
    truckvo.lcTemp = '';
    truckvo.lcAcwt = 0;
    truckvo.lcDteTyp = '';
    truckvo.llIscatch = false;
    truckvo.lcIsBlast = 'N';
    truckvo.llIsHPPIn = false;
    truckvo.lcIsHPP = 'N';
    truckvo.lnIntie = 0;
    truckvo.lnHigh = 0;
    truckvo.llUsedF6 = false;
    truckvo.lcLotPattern = '';
    truckvo.lnLotPatternStart = 0;
    truckvo.pcCurProd = truckvo.lcProd;
    truckvo.llQuickrcv = false;
    truckvo.llIntruckToTruck = false;
    truckvo.llInTruckStage = false;
    truckvo.llIsConsCross = false;
    truckvo.pnHandKeyConsigneeCross = false;
    let errMsg: String = '';
    let scrnUI = [];
    let fponum: any;
    let outkey = '';

    let lcProd = body?.prod?.trim().toUpperCase();
    const lcTempProd = lcProd;

    const CONFIG = (truckvo.CONFIG as unknown) as Config;
    const gcActiv = CONFIG?.factiv === true;
    if (gcActiv && truckvo.lcOldProd.length > 0 && lcProd === '6') {
      return this.USEDF6COPY(fwho, truckvo, constant);
    }

    if (Number(lcProd) > 0 && lcTempProd.length > 0) {
      lcProd = lcTempProd;
    }

    lcProd = `${lcProd}${' '.repeat(16)}`.slice(0, 16);

    if (lcProd.toString().trim().length > 0) {
      const [curCode2] = await this.manager().query(
        `BEGIN
          SELECT TOP(1) [c2].[FCUSTCODE], [c2].[FPRODGROUP], [c2].[FPRODUCT], [c2].[FOWNER], [c2].[FSUPLRPROD], [c2].[ACTIVE],
          [c2].[FCATCHWGT], [c2].[FNETWGT], [c2].[FDATETYPE], [c2].[FBLASTHRS], [c2].[FTIE], [c2].[FHIGH], [c2].[FBLASTROOM], [c2].[FISHPP], [c2].[FBBDTETYPE],
          [c2].[flength],[c2].[fwidth],[c2].[fheight]
          FROM [dbo].[CODE2] [c2]
          WHERE (c2.FPRODUCT = '${lcProd}' OR c2.FSUPLRPROD = '${lcProd}')
          AND [c2].[FCUSTCODE] IN ( SELECT DISTINCT FCUSTCODE FROM [dbo].[LOADIN] li WHERE [li].[FCONFIRMNM] = '${truckvo?.pcConfirmationNumber}' )
          ORDER BY [c2].[ACTIVE] DESC, case when [c2].[FPRODUCT]='${lcProd}' then 0 else 1 end, [c2].[ID];
      END`,
      );

      truckvo.curCode2 = curCode2;
      truckvo.lcProd = lcProd;
      const pc_fproduct = curCode2?.FPRODUCT ? curCode2.FPRODUCT : '';

      const curPONumbersRes: Array<PoInfo> = await this.manager().query(
        `BEGIN
          SELECT DISTINCT [li].[FPONUM], [li].[FBATCH], [li].[FCUSTCODE], [li].[FOWNER],
          CASE WHEN EXISTS (SELECT 1 FROM [dbo].[RFEXPINV] [rf1] WHERE [rf1].[FBATCH] = [li].[FBATCH]
          AND [rf1].[FPRODUCT] = '${pc_fproduct}' ) THEN '*' ELSE ' ' END AS [M], CAST(0 as bit) as lProcessed
          FROM [dbo].[LOADIN] [li] LEFT JOIN [dbo].[RFEXPINV] rf ON [li].[FBATCH] = [rf].[fbatch]
          WHERE [li].[FCONFIRMNM] = '${truckvo?.pcConfirmationNumber}' ORDER BY M DESC;
       END`,
      );

      truckvo.curPONumbers = curPONumbersRes;
      fponum = curPONumbersRes.map((el: PoInfo) => ({
        FPONUM: el.FPONUM.trim(),
        M: el.M.trim(),
      }));

      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PO_NUMBER;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

      scrnUI = [];
      outkey = 'pono';
      const pofield: any = getFields(TruckReceiveState.MARK_PROCESS_PO_NUMBER);
      pofield.avoidable = false;
      scrnUI.push(pofield);

      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.avoidable = true;
      scrnUI.push(prodField);

      const confirmField = getFields(
        TruckReceiveState.MARK_PROCESS_CONFIRMATION,
      );
      confirmField.avoidable = true;
      scrnUI.push(confirmField);
    } else {
      lcProd = '';
      errMsg = constant.PRODUCT_BLANK;
      scrnUI = [];
      outkey = 'conprod';
      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.avoidable = true;
      scrnUI.push(prodField);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        infoMsg: '',
        scrnUI,
        data: fponum,
      }),
      getOutputFields(outkey),
      '',
      '',
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD
        ? `${constant.F5_EXIT.trim()}`
        : `${constant.F2_SKIP.trim()}~${constant.F4_PICK.trim()}~${constant.F5_EXIT.trim()}`,
    );
  }

  async processPONumberScreen(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    const curCode2: Code2Obj = truckvo.curCode2;
    let result: Boolean = false;

    const curPONumbers: PoInfo | undefined = truckvo?.curPONumbers?.find(
      (el: PoInfo) => el.FPONUM.trim() === body?.pono?.trim(),
    );

    // response added for if pono not found
    if (!curPONumbers) {
      const scrnUI = [];
      const pofield: any = getFields(TruckReceiveState.MARK_PROCESS_PO_NUMBER);
      pofield.avoidable = false;
      pofield.hideUntilEnabled = false;
      scrnUI.push(pofield);

      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          curOper: truckvo.curOper,
          errMsg: '',
          infoMsg: '',
          scrnUI,
        }),
        getOutputFields('pono'),
        '',
        '',
        `${constant.F2_SKIP.trim()}~${constant.F4_PICK.trim()}~${constant.F5_EXIT.trim()}`,
      );
    }

    const LOADINresult = await this.manager().query(
      `BEGIN
        SELECT id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate, floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse, ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted, ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi, fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, TRIM(fscanwho) as fscanwho, fscanstdte, fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort, fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment, fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop, fschcoment, fsignintme, fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust, fgroupcode, fcpc, fconsignor, TRIM(foutbatch) foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched, fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid, ftmsresend, cancelled
        FROM dbo.Loadin WHERE fbatch = '${curPONumbers.FBATCH}' order by fbatch ASC ;
      END`,
    );
    const LOADIN: Loadin = LOADINresult[0];
    const carrier = await this.manager().query(
      `SELECT TOP 1 LineageFreightManagement FROM CARRIER WHERE FCUSTCODE = '${LOADIN?.fcarrier}'`,
    );
    truckvo.lineageFreightManagement =
      carrier && carrier.length > 0
        ? carrier[0].LineageFreightManagement
        : false;
    const quickRec = await this.manager().query(
      `SELECT TOP 1 TRIM(fquickrcv) as fquickrcv FROM QUICKREC WHERE FINBATCH ='${LOADIN.fbatch}'`,
    );
    truckvo.quickRec = quickRec ? quickRec[0] : {};
    const [loadresult] = await this.manager()
      .query(`SELECT TOP 1 im.FBATCH as fbatch, trim(ep.FPALLETID) as fpalletid,l.FDOOR as fdoor
      FROM dbo.EDI_PAL ep
      JOIN dbo.INV_MST im ON RIGHT(trim(ep.FPALLETID),16) = im.FLOT
      JOIN dbo.LOADOUT l  ON im.FBATCH = l.FBATCH
      WHERE ep.FBATCH = '${truckvo?.lcBatch}' AND im.FRECTYPE = 'C'`);
    if (LOADIN) {
      // Show the message to user if quickrcv is L,D,S
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PO_NUMBER) {
        let notes;
        let mergedNotes = '';
        if (LOADIN.fcustcode && LOADIN.fconsignor.trim() !== '') {
          // Get notes from stored procedure
          const spResult = await this.storedProcedureService.getRfShowcustomerconsigneenotes(
            {
              lcconsig: LOADIN.fconsignor.trim().replace('/', ''),
              lccustomer: LOADIN.fcustcode,
              lctype: 'RECV',
              lnheight: 4,
            },
          );
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
          const curNotes = [
            {
              note: mergedNotes,
            },
          ];
          // Set final values
          notes = mergedNotes;

          if (curNotes && curNotes.length > 0) {
            // merge all the notes into single string
            mergedNotes = curNotes.map((curNote: any) => curNote.note).join('');
          }
          notes =
            mergedNotes && mergedNotes.trim().length > 0
              ? mergedNotes
              : curNotes[0]?.note || '';
        } else if (LOADIN.fcustcode && LOADIN.fconsignor.trim() === '') {
          const curNotes = await this.manager().query(`BEGIN
          DECLARE @curNotes TABLE (FLINE int, NOTE varchar(38));
          INSERT INTO @curNotes EXEC [dbo].[usp_RF_ShowCustomerConsigneeNotes]
          @lcCustomer = '${LOADIN.fcustcode}',
          @lcConsig = '',
          @lcType = 'RECV',
          @lnHeight  = 4;
          SELECT note FROM @curNotes;
          END`);
          if (curNotes && curNotes.length > 0) {
            // merge all the notes into single string
            mergedNotes = curNotes.map((curNote: any) => curNote.note).join('');
          }
          notes =
            mergedNotes && mergedNotes.trim().length > 0
              ? mergedNotes
              : curNotes[0]?.note || '';
        }
        if (
          loadresult &&
          loadresult.fbatch &&
          truckvo.quickRec.fquickrcv === 'D'
        ) {
          notes = `${constant.TAKE_TO_DOOR} ${loadresult.fdoor}`;
        } else if (
          !notes &&
          truckvo.quickRec &&
          truckvo.quickRec.fquickrcv?.trim().length > 0
        ) {
          const rcvType = truckvo.quickRec?.fquickrcv;
          const notesData: Record<string, string> = {
            L: constant.LEAVE_ON_TRUCK,
            D: constant.STORE_ON_DOCK,
            S: constant.STORE_IN_FREEZER,
          };
          notes = notesData[rcvType] || '';
        }

        if (
          notes &&
          truckvo.quickRec &&
          truckvo.quickRec.fquickrcv?.trim() !== 'D'
        ) {
          truckVo.navigatePallet = ['L', 'S'].includes(
            truckVo?.quickRec?.fquickrcv,
          )
            ? true
            : false;
          truckvo.curOper = TruckReceiveState.MARK_SHOW_NOTES;
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
          return new ResponseKeysDTO(
            plainToClass(PostResponseTruckReceiveDTO, {
              errMsg: '',
              infoMsg: '',
              curOper: truckvo.curOper,
              data: notes,
              label: 'Notes',
            }),
            getOutFieldState(truckvo.curOper),
            '',
            '',
            `${constant.F5_EXIT}`,
          );
        }
      }
    }

    if (curPONumbers?.FOWNER?.trim().length > 0) {
      if (
        curPONumbers?.FCUSTCODE?.trim() === curCode2?.FCUSTCODE?.trim() &&
        curPONumbers?.FOWNER?.trim() === curCode2?.FOWNER?.trim() &&
        curCode2?.FPRODUCT?.trim() === truckvo?.lcProd?.trim()
      ) {
        result = true;
      } else if (
        curCode2?.FCUSTCODE?.trim() === curPONumbers?.FCUSTCODE?.trim() &&
        curCode2?.FSUPLRPROD?.trim() === truckvo?.lcProd?.trim()
      ) {
        result = true;
      }
    } else if (
      curCode2?.FCUSTCODE?.trim() === curPONumbers?.FCUSTCODE?.trim() &&
      curCode2?.FPRODUCT?.trim() === truckvo?.lcProd?.trim()
    ) {
      result = true;
    }

    if (result) {
      if (curCode2?.ACTIVE?.trim() === 'N') {
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

        const scrnUI = [];

        const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
        prodField.avoidable = false;
        prodField.hideUntilEnabled = false;
        prodField.defaultVal = truckvo?.lcProd?.trim();
        prodField.value = truckvo?.lcProd?.trim();
        scrnUI.push(prodField);

        const confirmField = getFields(
          TruckReceiveState.MARK_PROCESS_CONFIRMATION,
        );
        confirmField.avoidable = true;
        scrnUI.push(confirmField);

        const ponoField = getFields(TruckReceiveState.MARK_PROCESS_PO_NUMBER);
        ponoField.avoidable = true;
        scrnUI.push(ponoField);

        return new ResponseKeysDTO(
          plainToClass(PostResponseTruckReceiveDTO, {
            curOper: truckvo.curOper,
            errMsg: constant.PRODUCT_IS_INACTIVE.trim(),
            infoMsg: '',
            scrnUI,
          }),
          getOutputFields('conprod'),
          '',
          '',
          `${constant.F5_EXIT.trim()}`,
        );
      }
      const [LOADIN] = await this.manager().query(
        `BEGIN
              SELECT id,fcustcode,fbatch,foutbatch,fscanstat,fshipstat,fcheckqty,
              fcheckgros,fscanentme,fscanendte,ffinishdte,ffinishtme,
              fconfirmnm,fbdate,fscanwho,fstarttme,fstartdte,fowner,
              fdoornum,fhasxdock,fconsignor
              FROM LOADIN
              WHERE FBATCH='${curPONumbers.FBATCH}';
           END`,
      );

      truckvo.LOADIN = LOADIN;

      const [RFEXPINV] = await this.manager().query(
        `BEGIN
              SELECT * FROM RFEXPINV
              WHERE FBATCH='${curPONumbers.FBATCH}' AND
              FPRODGROUP='${curCode2.FPRODGROUP}' AND
              FPRODUCT='${curCode2.FPRODUCT}' AND
              FOWNER='${curCode2.FOWNER}' AND
              FSUPLRPROD='${curCode2.FSUPLRPROD}';
           END`,
      );

      if (truckvo.llQuickrcv && !truckvo.llIntruckToTruck && !RFEXPINV) {
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

        const scrnUI = [];

        const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
        prodField.avoidable = false;
        prodField.hideUntilEnabled = false;
        prodField.defaultVal = truckvo?.lcProd?.trim();
        prodField.value = truckvo?.lcProd?.trim();
        scrnUI.push(prodField);

        const confirmField = getFields(
          TruckReceiveState.MARK_PROCESS_CONFIRMATION,
        );
        confirmField.avoidable = true;
        scrnUI.push(confirmField);

        const ponoField = getFields(TruckReceiveState.MARK_PROCESS_PO_NUMBER);
        ponoField.avoidable = true;
        scrnUI.push(ponoField);

        return new ResponseKeysDTO(
          plainToClass(PostResponseTruckReceiveDTO, {
            curOper: truckvo.curOper,
            errMsg: constant.NOT_QUICK_RCV_PROD.trim(),
            infoMsg: '',
            scrnUI,
          }),
          getOutputFields('conprod'),
          '',
          '',
          `${constant.F5_EXIT.trim()}`,
        );
      }
      truckvo.llIscatch =
        curCode2.FCATCHWGT === 'I' || curCode2.FCATCHWGT === 'B'; //  see if needs catchweight
      truckvo.llOldCatch = truckvo.llIscatch;
      truckvo.lcAcwt = curCode2.FNETWGT;
      truckvo.lcOldAcwt = truckvo.lcAcwt;
      truckvo.lcDteTyp =
        curCode2.FDATETYPE && curCode2.FDATETYPE === '1'
          ? 'J'
          : curCode2.FDATETYPE === '2'
            ? 'C'
            : 'N';
      truckvo.lcOldDteTyp = truckvo.lcDteTyp;
      truckvo.lnBlasthrs = curCode2.FBLASTHRS === 0 ? 72 : curCode2.FBLASTHRS;
      truckvo.pnWidth = curCode2.fwidth;
      truckvo.pnHeight = curCode2.fheight;
      truckvo.pnLength = curCode2.flength;
      truckvo.lnIntie = curCode2.FTIE;
      truckvo.lnOldTie = truckvo.lnIntie;
      truckvo.lnHigh = curCode2.FHIGH;
      truckvo.lnOldHigh = truckvo.lnHigh;
      truckvo.lcOldProd = truckvo.lcProd;
      truckvo.lcIsBlast = curCode2?.FBLASTROOM?.trim().length > 0 ? 'Y' : 'N';
      truckvo.lcIsBlast1 = curCode2?.FBLASTROOM?.trim().length > 0 ? 'Y' : 'N';
      truckvo.lcIsHPP = curCode2?.FISHPP === true ? 'Y' : 'N';
      truckvo.llIsHPPIn = curCode2?.FISHPP === true;
      truckvo.lcBbdtetype = curCode2.FBBDTETYPE ? curCode2.FBBDTETYPE : '';

      const [CODE2] = await this.manager().query(
        `BEGIN
              SELECT
              id, active, fcustcode,  fowner, fproduct, fsuplrprod, fprodgroup, fcatchwgt, fdatetype,fpickdays, ftare,
              fblasthrs, fhold, ftie, fhigh,fblastroom, fbbdtetype, fishpp, fpickcode,flotpatid, fshelflife,fgrosswgt, fnetwgt
              FROM CODE2 WHERE
              FCUSTCODE ='${curCode2.FCUSTCODE}' AND
              FPRODGROUP='${curCode2.FPRODGROUP}' AND
              FPRODUCT='${curCode2.FPRODUCT}' AND
              FOWNER='${curCode2.FOWNER}' AND
              FSUPLRPROD='${curCode2.FSUPLRPROD}';
             END`,
      );

      truckvo.CODE2 = CODE2;

      await this.getLotPatternConfig(truckvo, CODE2);

      const FBATCH = curPONumbers?.FBATCH?.toString();
      const FPRODUCT = curCode2?.FPRODUCT ? curCode2?.FPRODUCT?.toString() : '';
      const FPRODGROUP = (curCode2?.FPRODGROUP
        ? curCode2?.FPRODGROUP?.toString().padEnd(4, ' ')
        : ''
      ).padEnd(4, ' ');

      truckvo.lcEdiReqBlastBatchProduct = `${FBATCH}${FPRODUCT}`;
      truckvo.lcReqBlastKey = `${FBATCH}${FPRODGROUP}${FPRODUCT}`;

      const [CUSTOMER] = await this.manager().query(
        `BEGIN
            SELECT FSTATUS,FUSEMETRIC,FFULPALCHG,FGLFULPAL FROM CUSTOMER WHERE FCUSTCODE='${LOADIN.fcustcode}';
         END`,
      );

      truckvo.lcBatch = LOADIN.fbatch;

      if (CUSTOMER) {
        truckvo.lcStatus = CUSTOMER.FSTATUS;
        truckvo.llUseMetric = CUSTOMER.FUSEMETRIC === true;
        truckvo.lnFulPalChg = CUSTOMER.FFULPALCHG;
        truckvo.lcFulPalgl = CUSTOMER.FGLFULPAL;
      } else {
        truckvo.lnFulPalChg = 0.0;
        truckvo.lcFulPalgl = '';
      }

      if (LOADIN?.foutbatch.trim() !== '') {
        if (truckvo?.CONFIG?.fquickbatch) {
          const [QUICKREC] = await this.manager().query(
            `BEGIN
                  SELECT FOUTBATCH,FQUICKRCV FROM QUICKREC WHERE FINBATCH='${LOADIN.fbatch}' ORDER BY FINBATCH ASC;
              END`,
          );

          // set flag for quick receiver Q,T types
          if (QUICKREC?.FOUTBATCH?.trim() === LOADIN?.foutbatch?.trim()) {
            truckvo.llIntruckToTruck = true;
            if (QUICKREC?.FQUICKRCV?.trim() === 'T') {
              truckvo.llInTruckStage = true;
            }
          }
        }

        const [LOADOUT] = await this.manager().query(
          `BEGIN
                 SELECT id,fscansttme,fscanendte FROM LOADOUT WHERE FBATCH='${LOADIN.fbatch}';
               END`,
        );
        if (LOADOUT) {
          await this.manager().query(
            `BEGIN
              UPDATE LOADOUT
              SET
              fscansttme = ${LOADOUT?.fscansttme
              ? LOADOUT.fscansttme
              : this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm')
            },
            fscanendte=${LOADOUT?.fscanendte
              ? LOADOUT.fscanendte
              : this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD')
            },
            fscanstat = 'S'
            WHERE ID='${LOADOUT.id}';
          END
                `,
          );
        }

        truckvo.lcOutbatch = LOADIN.foutbatch;
        truckvo.llQuickrcv = true;
      } else {
        if (truckvo?.CONFIG?.fquickbatch) {
          const [QUICKREC] = await this.manager().query(
            `BEGIN
                    SELECT FQUICKRCV FROM QUICKREC WHERE FINBATCH='${LOADIN.fbatch}' ORDER BY FINBATCH;
              END`,
          );

          if (QUICKREC?.FQUICKRCV?.trim() === 'C') {
            truckvo.llIsConsCross = true;
          }
        }
        truckvo.lcOutbatch = '';
        truckvo.llQuickrcv = false;
      }
    } else {
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

      const scrnUI = [];

      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.avoidable = false;
      prodField.hideUntilEnabled = false;
      prodField.defaultVal = truckvo?.lcProd?.trim();
      prodField.value = truckvo?.lcProd?.trim();
      scrnUI.push(prodField);

      const confirmField = getFields(
        TruckReceiveState.MARK_PROCESS_CONFIRMATION,
      );
      confirmField.avoidable = true;
      scrnUI.push(confirmField);

      const ponoField = getFields(TruckReceiveState.MARK_PROCESS_PO_NUMBER);
      ponoField.avoidable = true;
      scrnUI.push(ponoField);

      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          curOper: truckvo.curOper,
          errMsg: constant.NO_ACTIVE_PROD_FOUND.trim(),
          infoMsg: '',
          scrnUI,
        }),
        getOutputFields('conprod'),
        '',
        '',
        `${constant.F5_EXIT.trim()}`,
      );
    }

    /**
     * DYNAMIC WAREHOUSING related code
     */

    if (
      !truckvo.llUsedF6 &&
      truckvo.plDynamicRail &&
      truckvo.pcCurProd.trim() !== truckvo.lcProd.trim()
    ) {
      await this.CalcPalletsFromProd(
        fwho,
        truckvo,
        truckvo.dynBat,
        truckvo.lcProd,
      );
      // line no:5246 to 5254
    }

    // from line no:301 onwards
    truckvo.lcCustCode = truckvo.LOADIN.fcustcode;

    const [CUSTREQ] = await this.manager().query(
      `BEGIN
          SELECT FLTCUSTLT,FPMCPALT,FCTBXSEQ,FHASBLAST,FGETPALWGT,FLTSAME
          FROM CUSTREQ WHERE FCUSTCODE='${truckvo?.LOADIN?.fcustcode}';
       END`,
    );

    if (CUSTREQ) {
      truckvo.lcHasLot = CUSTREQ?.FLTCUSTLT?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcHasCust = CUSTREQ?.FPMCPALT?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcHasBlast = CUSTREQ?.FHASBLAST?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.llPalWgt = CUSTREQ.FGETPALWGT;
    }
    /**
     * New code added for ecert to get all rf versions
     */
    let RFREQ;
    let RFREQNEW;
    const configCheck = await this.dynamicAttributesService.configCheck(
      this.manager(),
    );
    if (
      configCheck.length > 0 &&
      configCheck[0]?.USE_BARCODE_SCANNING_MAINTENANCE
    ) {
      RFREQNEW = await this.dynamicAttributesService.getRfInfoVersions(
        this.manager(),
        truckvo?.LOADIN?.fcustcode,
        truckvo?.LOADIN?.fconsignor,
      );
      RFREQ = RFREQNEW[0];
    } else {
      [RFREQ] = await this.manager().query(
        `BEGIN
            SELECT
            id, fcustcode, fkeylot, fkeyref, fkeytemp, fscanlngth, fprodfrom,  fprodto, fdtefrom, fdteto,
            fwgtfrom, fwgtto,  fboxfrom, fboxto, fscantype,  fcpal, fcpalfrom, fcpalto, fcustlot, fproduct, fcodedate,
            fweight, fbox, fpallet, fcpallet, fqty, flot, fclot, fpalfrom, fpalto,  fqtyfrom, fqtyto, flotfrom, flotto,
            fclotfrom, fclotto, fuse128Bar, fprodvar, fprodvfrom, fprodvto, fltestbnum, fbbdtefrom, fbbdteto, fbbcodedte,
            ffilllot, fdupoutbox, fhndkeywgt, fyywwdcool, fuseasnovr, fprodasn, flotasn, fdateasn, fqtyasn, fedipal, ffirstsscc,
            fcoolcode, fcoolcodefrom, fcoolcodeto, edipalnoqty, ALT_128_CHECK as alt128check, calcProdOrBBDate, CustomerPIDLength,
            AutoFillConsignee,XDockBadPIDToInvCtrl
            FROM dbo.RFREQ WHERE fcustcode = '${truckvo?.LOADIN?.fcustcode}' order by fcustcode ASC ;
        END`,
      );
    }

    truckvo.RFREQ = RFREQ;
    let llRffnd = false;

    if (RFREQ) {
      llRffnd = true;
      truckvo.lcKeyLot = RFREQ?.fkeylot?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyEstb = RFREQ?.fltestbnum?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyRef = RFREQ?.fkeyref?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyTmp = RFREQ?.fkeytemp?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.llUse128Barcode = RFREQ.fuse128Bar;
      truckvo.lnBarcodeScanLength = RFREQ.fscanlngth;
      truckvo.ywwdcool = RFREQ.fyywwdcool ? RFREQ.fyywwdcool : false;
      truckvo.llASNpal = RFREQ.fedipal ? RFREQ.fedipal : false;
      truckvo.llASNpalNoQty = RFREQ.edipalnoqty ? RFREQ.edipalnoqty : false;
      truckvo.lnCustomerPIDLength = RFREQ.CustomerPIDLength;
      truckvo.plAutoFillConsignee = RFREQ.AutoFillConsignee;
    }
    truckvo.llRrffnd = llRffnd;

    const [CUSTSET] = await this.manager().query(
      `BEGIN
          SELECT  id, fedistatbp, fediblstst, FUTURE_DATE as futureDate, autodateforprodlot,
          VALIDATE_PAL_LENGTH as validatePaLLength, fcdt2Back, ffuturedte,PAL_MAX_LENGTH as palMaxLength,
          IBRotationRestriction , HandKeyConsigneeCross
          FROM dbo.CUSTSET WHERE fcustcode = '${truckvo?.LOADIN?.fcustcode}' order by fcustcode ASC ;
       END`,
    );

    if (CUSTSET) {
      truckvo.llBatchProdEdiStatus = CUSTSET.fedistatbp
        ? CUSTSET.fedistatbp
        : false;
      truckvo.lcEdiControlReqBlast = CUSTSET.fediblstst
        ? CUSTSET.fediblstst
        : ' ';
      truckvo.plFutureDate = CUSTSET.futureDate;
      truckvo.plAutoDateForProdLot = CUSTSET.autodateforprodlot;
      truckvo.lnPalMaxLength = CUSTSET.palMaxLength;
      truckvo.plIBRotationRestriction = CUSTSET.IBRotationRestriction;
      truckvo.llValidatePalLength = CUSTSET.validatePaLLength;
      truckvo.pnHandKeyConsigneeCross = CUSTSET.HandKeyConsigneeCross
        ? CUSTSET.HandKeyConsigneeCross
        : false;
      truckvo.lnYearsback = CUSTSET.fcdt2Back ? 2 : 1;
      truckvo.ffuturedte = CUSTSET.ffuturedte ? CUSTSET.ffuturedte : false;
    }

    let data = {};
    const scrnUI: any = [];
    let outKey = '';

    const [loadin] = await this.manager().query(
      `BEGIN
        SELECT id, trim(fscanstat) fscanstat
        FROM dbo.Loadin
        WHERE fbatch = '${truckvo.lcBatch}'
        order by fbatch ASC ;
       END`,
    );

    truckvo.pcMultiRecScanStat = loadin?.fscanstat || '';

    if (truckvo.plMultiReceiver && truckvo.pcMultiRecScanStat === 'R') {
      truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE_REC;
      const closePalRField = getFields(
        TruckReceiveState.MARK_RECEIVING_CLOSE_REC, // Batch Closed By Another Receiver
      );
      outKey = 'closePalR';
      scrnUI.push(closePalRField);
    } else if (truckvo.llIntruckToTruck && !truckvo.lcInMachineID) {
      truckvo.lcInMachineID = '';
      truckvo.prevCurOper = TruckReceiveState.MARK_RECEIVING_GETMACHINEID;
      truckvo.curOper = TruckReceiveState.MARK_RECEIVING_GETMACHINEID;
      outKey = 'eqId';
      const eqIdField = getFields(
        TruckReceiveState.MARK_RECEIVING_GETMACHINEID,
      );
      scrnUI.push(eqIdField);
    } else if (
      truckvo.quickRec &&
      ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
    ) {
      body.palNo = truckvo.lcPal;
      if (truckvo.isSSCCPallet) truckvo.skipMaskValid = true;
      return await this.processPalletID(fwho, truckvo, body, constant);
    } else {
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PALLET;
      truckvo.lcPal = '';

      const scanInfo = {
        lc_keylot: truckvo.lcKeyLot,
        lc_keyestb: truckvo.lcKeyEstb,
        lc_keyref: truckvo.lcKeyRef,
        llUse128Barcode: truckvo.llUse128Barcode,
        lnBarcodeScanLength: truckvo.lnBarcodeScanLength,
        ll_yywwdcool: truckvo.ywwdcool,
        ll_ASNpal: truckvo.llASNpal,
        plAlt128Check: truckvo.plAlt128Check,
        ll_ASNpalNoQty: truckvo.llASNpalNoQty,
      };

      data = {
        CODE2: truckvo.CODE2,
        RFREQ: truckvo.RFREQ,
        scanInfo,
        RFREQNEW,
        batch: truckvo.lcBatch,
      };

      const palField = getFields(TruckReceiveState.MARK_PROCESS_PALLET);
      if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
        palField.maxFieldLen = truckvo.RFREQ.fscanlngth;
      }
      scrnUI.push(palField);

      const batchField = getFields(TruckReceiveState.SHOW_PROCESS_BATCH);
      batchField.defaultVal = truckvo.lcBatch.trim();
      batchField.value = truckvo.lcBatch.trim();
      scrnUI.push(batchField);
      outKey = 'palletID';
    }

    let footer =
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
        ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
        ? `${constant.F5_EXIT}`
        : truckvo.lineageFreightManagement
          ? `${constant.F5_EXIT}`
          : `${constant.F5_EXIT}~${constant.F8_LABL}`;

    if (truckvo.curOper === 'MARK_RECEIVING_GETMACHINEID') {
      footer = `${constant.F5_EXIT}`;
    }

    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg: '',
        infoMsg: '',
        data,
        scrnUI,
      }),
      getOutputFields(outKey),
      '',
      '',
      footer,
    );
  }

  getCheckSwapByLotBarcode(truckvo: TruckReceiveVO): boolean {
    let resultbar: boolean = false;
    // let lcWorkingPid = '';
    try {
      if (truckvo.lcPal && truckvo.lcPal.length > 4) {
        truckvo.lcWorkingPid = truckvo.lcPal;
        const l = [...truckvo.lcWorkingPid];
        if (
          !Number.isNaN(Number(l[0])) &&
          !Number.isNaN(Number(l[1])) &&
          !Number.isNaN(Number(l[2])) &&
          l[3] === '-'
        ) {
          truckvo.lcPal = `${truckvo.lcWorkingPid.slice(
            4,
            -1,
          )}-${truckvo.lcWorkingPid.slice(0, 3)}`;
          resultbar = true;
        }
      }
    } catch (error) {
      this.logger.error(
        { error, message: 'LOADIN error getCheckSwapByLotBarcode -->' },
        'Error in getCheckSwapByLotBarcode',
        TruckReceiveService.name,
      );
    }
    return resultbar;
  }

  async processPalletIDPrinter(
    fwho: string,
    body: PostRequestTruckReceiveDTO,
    truckVO: TruckReceiveVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    if (body.pnInput && body.pnInput.toUpperCase() === 'F8') {
      truckVO.plUsedF8 = true;
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
        truckVO.LOADIN.fcustcode,
        truckVO.LOADIN.fconsignor,
      ]);
      if (ssccResult && ssccResult[0] && ssccResult[0].ReturnValue) {
        body.palNo = ssccResult[0].ReturnValue.trim();
        truckVO.skipMaskValid = true;
        truckVO.isSSCCPallet = true;
        return this.processPalletID(fwho, truckVO, body, constant);
      }
      return this.processPalletID(fwho, truckVO, body, constant);
    }
    return this.processPalletID(fwho, truckVO, body, constant);
  }

  async updateInvControl(
    fwho: string,
    body: PostRequestTruckReceiveDTO,
    truckVo: TruckReceiveVO,
    constant: any,
  ) {
    const { lcScanInvLocation } = body;
    const [invControl] = await this.manager().query(`BEGIN
      SELECT TOP 1 flocation FROM LOCATION WHERE flocation = '${lcScanInvLocation}' and fstoretype = 'I';
      END`);
    if (invControl) {
      const fdateStamp = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS');

      const insertInvControl = `BEGIN INSERT INTO INVCONTROL (fscanloc,foperid,fdateStamp,fworktype,fpalletid,fequipid,fwho,fmbol,fcustcode,fproblem,fhowfixed) VALUES ('${lcScanInvLocation}','${fwho}','${fdateStamp}','XDOCKTRUCK','${truckVo.lcPal}','${truckVo.pcMachineID}','${fwho}','${truckVo.pcConfirmationNumber}','${truckVo.lcCustCode}','Unexpected Pallet','Unexpected Pallet on the Inbound Order'); END;`;

      await this.manager().query(insertInvControl);

      return await this.processNavigateToPalletIdScreen(
        fwho,
        truckVo.LOADIN?.fconfirmnm,
        truckVo,
        constant,
      );
    }
    return await this.takeToInventoryScreen(
      fwho,
      truckVo,
      constant,
      'INVALID LOCATION',
    );
  }

  async takeToInventoryScreen(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
    errorMsg: string = '',
  ) {
    truckVo.curOper = TruckReceiveState.MARK_INVCONTROL_SCREEN;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckVo);
    const scrnUI = [];

    let jsonFields = [];
    jsonFields = lodash.filter(TRUCKRECEIVEGUI.fields, {
      groupID: 30,
    });

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: errorMsg,
        infoMsg: '',
        curOper: truckVo.curOper,
        scrnUI: jsonFields,
        data: [{ label: `${fwho}`, value: '' }],
      }),
      getOutputFields('lcScanInvLocation'),
      '',
      '',
      '',
    );
  }

  async processPalletID(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    let errMsg = '';
    let outKey = '';
    const scrnUI = [];
    let data = { CODE2: {}, batch: '' };
    data.CODE2 = truckvo.CODE2;
    const LOADIN = (truckvo.LOADIN as unknown) as Loadin;
    truckvo.llYrFormatSet = false;

    let lcPal: string = '';
    truckvo.lcPal = lcPal;
    truckvo.lcCustpal = '';
    truckvo.lcCoolCode = '';
    truckvo.lcDte = '';
    truckvo.lcJdte = '';
    truckvo.lcBbdte = '';
    truckvo.lcBBJULIAN = '';
    truckvo.lcQty = '';
    truckvo.plUnmatchedAsnQty = false;
    truckvo.pnExpectedAsnQty = 0;
    truckvo.lcLot = '';
    truckvo.lcClot = '';
    truckvo.lcEstb = '';
    truckvo.lcSlaughDte = '';
    truckvo.lcRef = '';
    truckvo.lcTemp = '';
    truckvo.llUsedF6 = false;
    truckvo.pcCurProd = lcPal;
    truckvo.skipLabelCheck = false;

    if (body.palNo && body.palNo.trim().length > 0) {
      lcPal = body.palNo.trim().toUpperCase();
      truckvo.lcPal = lcPal;
      /*** Mask Definition Validation ****/
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PALLET;
      const maskResult = new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          errMsg,
          infoMsg: '',
          curOper: truckvo.curOper,
        }),
        getOutFieldState(truckvo.curOper),
        '',
        '',
        '',
      );
      const maskDefValid = await this.validateMaskDefinitionService.palletMaskDefinition<
        PostResponseTruckReceiveDTO,
        TruckReceiveVO
      >(
        maskResult,
        truckvo.LOADIN.fcustcode,
        lcPal,
        MaskingTypeEnum.PALLETID,
        truckvo,
        ModuleNameEnum.TRUCK_RECEIVE,
      );
      if (maskDefValid) {
        return maskDefValid;
      }

      const RFREQ = (truckvo.RFREQ as unknown) as Rfreq;
      if (
        truckvo.quickRec &&
        ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv) &&
        truckvo.curOper !== TruckReceiveState.MARK_PROCESS_PO_NUMBER
      ) {
        const [result] = await this.manager().query(`BEGIN
          SELECT TOP 1 li.fbatch,li.fcustcode,ep.fponum,ep.fproduct,ep.flot FROM LOADIN li 
          JOIN EDI_PAL ep ON li.FBATCH = ep.FBATCH AND ep.FPALLETID = '${truckvo.lcPal}'
          WHERE li.FCONFIRMNM = '${truckvo.pcConfirmationNumber}';
          END`);
        truckvo.lcBatch = result
          ? result?.fbatch?.trim()
          : truckvo.LOADIN?.fbatch?.trim();

        //  if we processed the po we already got the custreq and don't need it again
        if (result) {
          const [CUSTREQ] = await this.manager().query(
            `BEGIN
              SELECT FLTCUSTLT,FPMCPALT,FCTBXSEQ,FHASBLAST,FGETPALWGT,FLTSAME
              FROM CUSTREQ WHERE FCUSTCODE='${result ? result?.fcustcode?.trim() : null
            }';
           END`,
          );

          if (CUSTREQ) {
            truckvo.lcHasLot = CUSTREQ?.FLTCUSTLT?.trim() === 'Y' ? 'Y' : 'N';
            truckvo.lcHasCust = CUSTREQ?.FPMCPALT?.trim() === 'Y' ? 'Y' : 'N';
            truckvo.lcHasBlast = CUSTREQ?.FHASBLAST?.trim() === 'Y' ? 'Y' : 'N';
            truckvo.llPalWgt = CUSTREQ.FGETPALWGT;
          }
        }
        //
        const quickRec = await this.manager().query(
          `SELECT TOP 1 TRIM(fquickrcv) as fquickrcv FROM QUICKREC WHERE FINBATCH = '${truckvo.lcBatch}'`,
        );
        truckvo.quickRec = quickRec ? quickRec[0] : {};
        const [loadin] = await this.manager().query(`BEGIN
          SELECT id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate, floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse, ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted, ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi, fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, TRIM(fscanwho) as fscanwho, fscanstdte, fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort, fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment, fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop, fschcoment, fsignintme, fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust, fgroupcode, fcpc, fconsignor, foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched, fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid, ftmsresend, cancelled
          FROM dbo.Loadin WHERE fbatch = '${truckvo.lcBatch.padStart(
          7,
          '0',
        )}' order by fbatch ASC ;
          END`);
        truckvo.LOADIN = loadin;
        let [phymst] = await this.manager().query(`BEGIN
          SELECT id,TRIM(fpalletid) as fpalletid,TRIM(fcustpalid) as fcustpalid,fshipstat,fqty,ftrack,frectype
          FROM PHY_MST WHERE FPALLETID = '${lcPal}' ORDER BY FPALLETID; END`);

        const checkLoaded = await this.checkPalletLoaded(
          truckvo,
          lcPal,
          constant,
        );
        if (checkLoaded) {
          return checkLoaded;
        }
        if (phymst && phymst.ftrack.slice(0, 7) !== truckvo.lcBatch) {
          return await this.processNavigateToPalletIdScreen(
            fwho,
            truckvo.LOADIN?.fconfirmnm,
            truckvo,
            constant,
          );
        }

        if (
          !result &&
          truckVo.quickRec.fquickrcv === 'D' &&
          RFREQ &&
          RFREQ.XDockBadPIDToInvCtrl
        ) {
          // M1X-11529
          return await this.takeToInventoryScreen(fwho, truckvo, constant);
        } else if (!result && !truckvo.lcProd) {
          truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
          const scrnUI = [];
          const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
          prodField.avoidable = false;
          prodField.hideUntilEnabled = false;
          scrnUI.push(prodField);
          return new ResponseKeysDTO(
            plainToClass(PostResponseTruckReceiveDTO, {
              data: {
                curOper: truckvo.curOper,
                errMsg: '',
                infoMsg: 'PRODUCT SCREEN',
                scrnUI,
              },
            }),
            getOutputFields('conprod'),
            '',
            '',
            `${constant.F5_EXIT}`,
          );
        }
        if (
          truckvo.quickRec.fquickrcv?.trim() !== 'D' &&
          truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
          !truckvo.navigatePallet
        ) {
          let notes = '';
          const rcvType = truckvo.quickRec.fquickrcv?.trim();
          const notesData: Record<string, string> = {
            L: constant.LEAVE_ON_TRUCK,
            D: constant.STORE_ON_DOCK,
            S: constant.STORE_IN_FREEZER,
          };
          notes = notesData[rcvType] || '';
          truckvo.curOper = TruckReceiveState.MARK_SHOW_NOTES;
          truckvo.navigatePallet = true;
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
          return new ResponseKeysDTO(
            plainToClass(PostResponseTruckReceiveDTO, {
              errMsg: '',
              infoMsg: '',
              curOper: truckvo.curOper,
              data: notes,
              label: 'Notes',
            }),
            getOutFieldState(truckvo.curOper),
            '',
            '',
            `${constant.F5_EXIT}`,
          );
        }
        truckvo.lcLot = result ? result?.flot?.trim() : truckvo.lcLot;
        truckvo.lcProd = result
          ? result?.fproduct?.trim()
          : truckvo.CODE2?.fproduct?.trim();
        truckvo.lcOldProd = truckvo.lcProd;
        truckVo.handpal = body.handpal || false;
        await this.updateData(fwho, loadin, truckvo);
        data.batch = truckvo.lcBatch;
      }
      if (
        truckvo.quickRec &&
        ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv) &&
        truckvo.curOper === TruckReceiveState.MARK_PROCESS_PO_NUMBER
      ) {
        data.batch = truckvo.lcBatch;
        const palletId = getFields(TruckReceiveState.MARK_PROCESS_PALLET);
        palletId.defaultVal = lcPal;
        palletId.value = lcPal;
        palletId.readable = true;
        palletId.editable = false;
        if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
          palletId.maxFieldLen = truckvo.RFREQ.fscanlngth;
        }
        scrnUI.push(palletId);
      }
      if (
        truckvo.quickRec &&
        ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv) &&
        truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET
      ) {
        let [phymst] = await this.manager().query(`BEGIN
          SELECT TOP 1 id,TRIM(fpalletid) as fpalletid,TRIM(fcustpalid) as fcustpalid,fshipstat,fqty,ftrack,frectype
          FROM PHY_MST WHERE FPALLETID = '${lcPal}' ORDER BY FPALLETID; END`);
        let [inv_mst] = await this.manager().query(`BEGIN
          SELECT TOP 1 flot from INV_MST WHERE BatchSeq = '${phymst?.ftrack}' order by SQLDATETIME DESC; END`);
        truckvo.lcLot = inv_mst && inv_mst.flot ? inv_mst.flot : '';
      }
      if (
        truckvo?.lcHasCust?.trim() === 'Y' &&
        truckvo.llRrffnd &&
        RFREQ?.fcpal?.trim() === 'Y'
      ) {
        truckvo.lcCustpal = lcPal;
      }
      lcPal = lcPal.toString().trim();
      if (truckvo.plUsedF8) {
        const d = getFields(TruckReceiveState.MARK_PROCESS_PALLET);
        d.defaultVal = lcPal;
        d.value = lcPal;
        d.readable = true;
        d.editable = false;
        if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
          d.maxFieldLen = truckvo.RFREQ.fscanlngth;
        }
        scrnUI.push(d);
      }
      if (this.getCheckSwapByLotBarcode(truckvo) === false) {
      } else if (
        truckvo.llRrffnd &&
        RFREQ &&
        (RFREQ.fpalfrom > 0 || RFREQ.fpalto > 0)
      ) {
        lcPal = lcPal.slice(RFREQ.fpalfrom, lcPal.length - RFREQ.fpalto);
      } else {
        lcPal = truckvo.lcPal;
      }

      let llPal = false;
      if (lcPal.length > 0) {
        if (truckvo.ywwdcool && lcPal.trim().length >= 6) {
          truckvo.lcDte = lcPal.slice(1, 5);
          truckvo.lcCoolCode = lcPal.slice(1, 6);
        }
        if (
          truckvo.llValidatePalLength &&
          lcPal.trim().length > truckvo.lnPalMaxLength
        ) {
          errMsg = constant.PID_LONG.trim();
          outKey = 'palletID';
        } else {
          if (truckvo.plMultiReceiver) {
            const LOADIN1result = await this.manager().query(
              `BEGIN
                SELECT id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate, floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse, ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted, ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi, fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, fscanwho, fscanstdte, fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort, fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment, fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop, fschcoment, fsignintme, fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust, fgroupcode, fcpc, fconsignor, foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched, fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid, ftmsresend, cancelled
                FROM dbo.Loadin WHERE fbatch = '${truckvo.lcBatch.padStart(
                7,
                '0',
              )}' order by fbatch ASC ;
              END`,
            );
            const LOADIN1: Loadin = LOADIN1result[0];
            if (LOADIN1 && LOADIN1.fscanstat) {
              truckvo.pcMultiRecScanStat = LOADIN1.fscanstat;
            }
            if (truckvo.pcMultiRecScanStat === 'R') {
              truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE_P;
              await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

              const c = getFields(TruckReceiveState.MARK_RECEIVING_CLOSE_P);
              scrnUI.push(c);
              return new ResponseKeysDTO(
                plainToClass(PostResponseTruckReceiveDTO, {
                  curOper: truckvo.curOper,
                  errMsg: '',
                  infoMsg: '',
                  infoMsg2: constant.DATA_NOT_SENT.trim(),
                  scrnUI,
                }),
                getOutFieldState(truckvo.curOper),
              );
            }
          }

          const date = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
          const time = this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');

          let pcmessage = '';
          let pcFPALLETID = ''; // added code according to V19
          const PHY_MST_SP = await this.facilityService.getConnection().query(
            `BEGIN
                DECLARE @return_value int, @out_FPALLETID char(20), @out_Response varchar(2000);
                EXEC @return_value = dbo.usp_mrs_rf_RenameLPN
                @In_LPN = '${lcPal}',
                @out_FPALLETID = @out_FPALLETID OUTPUT,
                @out_Response = @out_Response OUTPUT;
                SELECT	@out_FPALLETID as 'pcFPALLETID', @out_Response as 'pcmessage';
              END`,
          );

          if (PHY_MST_SP && PHY_MST_SP[0]) {
            pcFPALLETID = PHY_MST_SP && PHY_MST_SP[0].pcFPALLETID;
            if (pcFPALLETID && pcFPALLETID?.trim()?.length > 0) {
              lcPal = pcFPALLETID.trim();
            }
            pcmessage =
              PHY_MST_SP && PHY_MST_SP[0].pcmessage
                ? PHY_MST_SP[0].pcmessage.trim()
                : '';
          }
          if (pcmessage === 'NOT SHIPPED') {
            let PHY_MST = await this.manager().query(
              `BEGIN
                 SELECT
                 id, TRIM(fpalletid) fpalletid, TRIM(fcustpalid) fcustpalid, fshipstat, fqty, ftrack, frectype
                 FROM PHY_MST WHERE FPALLETID = '${lcPal}' ORDER BY FPALLETID ASC
              END`,
            );

            if (PHY_MST.length > 0) {
              const { ftrack, frectype } = PHY_MST[0];
              if (ftrack.slice(0, 7) !== truckvo.lcBatch) {
                errMsg = constant.PALLET_DUPLICATE.trim();
                outKey = 'palletID';
              } else if (frectype.toUpperCase() === 'O') {
                errMsg = constant.PALLET_REC.trim();
                outKey = 'palletID';
              } else if (truckvo.dynBat.length > 0) {
                outKey = 'palReScan';
                llPal = true;
              } else {
                llPal = true;
              }
            } else {
              const p = new PhyMst();
              p.fpalletid = lcPal;
              p.fcustcode = LOADIN.fcustcode;
              p.ftrack = LOADIN.fbatch;
              p.fpal = 1;
              p.foPal = 1;
              p.fdatestamp = new Date(date);
              p.ftimestamp = time;
              p.frectype = 'X';
              p.fshipstat = 'N';
              p.fwho = fwho;
              p.fscanwho = fwho;
              p.fscantime = time;
              p.fscandte = new Date(date);
              p.fstatus = truckvo.lcStatus;
              await this.phymstRepo().save(p);
              llPal = true;
            }
          } else {
            const p = new PhyMst();
            p.fpalletid = lcPal;
            p.fcustcode = LOADIN.fcustcode;
            p.ftrack = LOADIN.fbatch;
            p.fpal = 1;
            p.foPal = 1;
            p.fdatestamp = new Date(date);
            p.ftimestamp = time;
            p.frectype = 'X';
            p.fshipstat = 'N';
            p.fwho = fwho;
            p.fscanwho = fwho;
            p.fscantime = time;
            p.fscandte = new Date(date);
            p.fstatus = truckvo.lcStatus;
            await this.phymstRepo().save(p);
            llPal = true;
          }
          if (llPal) {
            if (outKey === 'palReScan') {
              truckvo.curOper = TruckReceiveState.MARK_PROCESS_PALLET_RESCAN;
            } else if (
              truckvo.lcHasCust === 'Y' &&
              truckvo.llRrffnd &&
              truckvo.RFREQ
            ) {
              truckvo.curOper = TruckReceiveState.MARK_PROCESS_CUST_PALLET;
              outKey = 'custPalletID';
              const custPal = getFields(
                TruckReceiveState.MARK_PROCESS_CUST_PALLET,
              );
              // prepopulate custPal if fcpal is Y
              if (truckvo.RFREQ.fcpal === 'Y') {
                outKey = '';
                truckvo.lcCustpal = truckvo.lcPal;
                custPal.defaultVal = truckvo.lcCustpal;
                custPal.value = truckvo.lcCustpal;
                custPal.readable = true;
                custPal.hideUntilEnabled =
                  truckvo.quickRec &&
                    ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
                    ? false
                    : true;
              }
              if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
                custPal.maxFieldLen = truckvo.RFREQ.fscanlngth;
              }
              scrnUI.push(custPal);
            }
            if (
              truckvo.quickRec &&
              ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
            ) {
              const palId = getFields(TruckReceiveState.MARK_PROCESS_PALLET);
              palId.defaultVal = body?.palNo?.trim() || truckVo.lcPal;
              palId.value = body?.palNo?.trim() || truckVo.lcPal;
              if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
                palId.maxFieldLen = truckvo.RFREQ.fscanlngth;
              }
              scrnUI.push(palId);
            }

            const prod = getFields(TruckReceiveState.MARK_PROCESS_PROD);
            prod.defaultVal = truckvo.lcProd.trim() || truckvo.CODE2?.fproduct;
            prod.value = truckvo.lcProd.trim() || truckvo.CODE2?.fproduct;
            prod.hideUntilEnabled =
              truckvo.quickRec &&
                ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
                ? false
                : true;
            scrnUI.push(prod);

            if (truckvo.CODE2?.fproduct?.trim() && !truckvo.lcProd.trim()) {
              truckvo.lcProd = truckvo.CODE2.fproduct;
            }

            if (
              !['custPalletID', 'palReScan', 'palletID'].includes(outKey.trim())
            ) {
              if (truckvo.llASNpal) {
                truckvo = await this.applyASN(truckvo);
              }

              if (truckvo.lcDteTyp === 'N') {
                truckvo.lcDte = moment(
                  truckvo.LOADIN.fbdate,
                  'YYYY-MM-DD',
                ).format('MMDDYYYY');

                truckvo.curOper = TruckReceiveState.MARK_PROCESS_QTY;
                const qty = getFields(TruckReceiveState.MARK_PROCESS_QTY);
                qty.badOneOfValidMsg = `${constant.QTY_TIE.trim()} ${truckvo.lnIntie
                  } X ${truckvo.lnHigh} ${constant.OK_QUES.trim()}`;
                qty.justDisplay = `${truckvo.lnIntie * truckvo.lnHigh}`;

                if (truckvo.llASNpal && truckvo.llASNpalNoQty === false) {
                  let tempqty = Number(truckvo.lcQty).toString();
                  tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
                  qty.defaultVal = tempqty;
                  qty.value = tempqty;
                } else {
                  qty.defaultVal = '';
                  qty.value = '';
                }

                qty.hideUntilEnabled =
                  truckvo.quickRec &&
                    ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
                    ? false
                    : true;
                scrnUI.unshift(qty); // focusable field always in 0th index

                const codeDate = getFields(
                  TruckReceiveState.SHOW_PROCESS_CDATE,
                );
                codeDate.defaultVal = truckvo.lcDte;
                codeDate.value = truckvo.lcDte;
                codeDate.hideUntilEnabled =
                  truckvo.quickRec &&
                    ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
                    ? false
                    : true;
                scrnUI.push(codeDate);
                outKey = 'qty';
              } else {
                truckvo.curOper = TruckReceiveState.MARK_PROCESS_DATE;

                outKey = truckvo.lcDteTyp === 'J' ? 'julinDate' : 'codeDate';
                const date = getFields(
                  truckvo.lcDteTyp === 'J'
                    ? TruckReceiveState.SHOW_PROCESS_JDATE
                    : TruckReceiveState.SHOW_PROCESS_CDATE,
                );
                date.hideUntilEnabled =
                  truckvo.quickRec &&
                    ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
                    ? false
                    : true;

                if (truckvo.llASNpal) {
                  date.defaultVal =
                    truckvo.lcDteTyp === 'J'
                      ? truckvo.lcJdte
                      : truckvo.lcDte !== ''
                        ? moment(truckvo.lcDte, 'MMDDYYYY').format('MM/DD/YYYY')
                        : truckvo.lcDte;
                  date.value =
                    truckvo.lcDteTyp === 'J'
                      ? truckvo.lcJdte
                      : truckvo.lcDte !== ''
                        ? moment(truckvo.lcDte, 'MMDDYYYY').format('MM/DD/YYYY')
                        : truckvo.lcDte;
                }
                scrnUI.unshift(date); // focusable field always in 0th index
              }
            }
          }
        }
      } else {
        errMsg = constant.PALLET_BLANK.trim();
        outKey = 'palletID';
      }
    } else {
      errMsg = constant.PALLET_BLANK.trim();
      outKey = 'palletID';
    }

    if (truckvo.plUsedF8) {
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_CUST_PALLET) {
        // Pushing MARK_PROCESS_CUST_PALLET
        const c = getFields(TruckReceiveState.MARK_PROCESS_CUST_PALLET);
        if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
          c.maxFieldLen = truckvo.RFREQ.fscanlngth;
        }
        c.defaultVal = truckvo.lcCustpal;
        c.value = truckvo.lcCustpal;
        c.hideUntilEnabled =
          truckvo.quickRec &&
            ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
            ? false
            : true;
        c.editable = true;
        scrnUI.push(c);
      }
    }

    const date = getFields(truckvo.lcDteTyp === 'J' ? TruckReceiveState.SHOW_PROCESS_JDATE : TruckReceiveState.SHOW_PROCESS_CDATE);
    let scrnUIField = truckvo.curOper === 'MARK_PROCESS_CUST_PALLET'
      ? getFields(TruckReceiveState.MARK_PROCESS_CUST_PALLET)
      : truckvo.curOper === 'MARK_PROCESS_DATE' ? date : getFields(TruckReceiveState.MARK_PROCESS_QTY);
    if (truckvo.curOper === 'MARK_PROCESS_CUST_PALLET' && truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
      scrnUIField.maxFieldLen = truckvo.RFREQ.fscanlngth;
    }
    let index = scrnUI.findIndex(element => element.rawID === scrnUIField.rawID);
    if (index >= 0 && truckvo.quickRec && ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)) {
      scrnUI[index].editable = true;
      scrnUI[index].hideUntilEnabled = false;
      scrnUI.sort((a, b) => {
        if (a.rawID === 'palletID') return -1;
        if (b.rawID === 'palletID') return 1;
        if (a.rawID === 'conprod' && b.rawID !== 'palletID') return -1;
        if (b.rawID === 'conprod' && a.rawID !== 'palletID') return 1;
        return a.rawID.localeCompare(b.rawID);
      });
    }
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        infoMsg: ['L', 'S'].includes(truckVo?.quickRec?.fquickrcv)
          ? 'NOTES_COMPLETED'
          : '',
        data,
        scrnUI,
      }),
      getOutputFields(outKey),
      '',
      '',
      `${constant.F5_EXIT.trim()}`,
    );
  }

  async processRescanPal(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    const lcSamePal = body.palReScan;
    if (lcSamePal && lcSamePal.toUpperCase() === 'Y') {
      const PHY_MST = await this.phymstRepo().findOne({
        where: {
          fpalletid: truckvo.lcPal,
        },
        order: {
          fpalletid: 'ASC',
        },
      });
      if (PHY_MST && PHY_MST.fmergeid && PHY_MST.fmergeid === 'MP') {
        const { fmergeid } = PHY_MST;
        PHY_MST.fmergeid = 'MP';
        await this.phymstRepo()
          .createQueryBuilder()
          .update(PHY_MST)
          .set({ fmergeid: '' })
          .where('fmergeid = :fmergeid', { fmergeid })
          .execute();
      }

      if (truckvo.lcHasCust === 'Y' && truckvo.llRrffnd && truckvo.RFREQ) {
        if (truckvo.RFREQ.fcpal === 'Y') {
          truckvo.lcCustpal = truckvo.lcPal;
          truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
        }
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_CUST_PALLET;
      } else {
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD;
      }
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD) {
        const p = getFields(TruckReceiveState.MARK_PROCESS_PROD);
        p.badAllowEmptyMsg = truckvo.llUse128Barcode
          ? constant.BAD_SCAN
          : constant.PRODUCT_BLANK;
        if (truckvo.llASNpal) {
          truckvo = await this.applyASN(truckvo);
          p.defaultVal = truckvo.lcProd;
          p.value = truckvo.lcProd;
        }
        scrnUI.push(p);
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    } else {
      errMsg = constant.PALLET_NOT.trim();
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        infoMsg: '',
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
    );
  }

  async processCustPal(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    let errMsg = '';
    let lcCustpal = '';
    const scrnUI = [];
    let outKey = 'custPalletID';
    let data = { CODE2: truckvo.CODE2 };
    if (body.custPal && body.custPal.trim().length > 0) {
      lcCustpal = body.custPal.trim().toUpperCase();
      truckvo.lcCustpal =
        lcCustpal && lcCustpal?.length > 0 && truckvo.lnCustomerPIDLength > 0
          ? lcCustpal.slice(truckvo.lnCustomerPIDLength * -1)
          : lcCustpal;

      if (truckvo.lnCustomerPIDLength > 0) {
        const custPal = getFields(TruckReceiveState.MARK_PROCESS_CUST_PALLET);
        custPal.defaultVal = truckvo.lcCustpal;
        custPal.value = truckvo.lcCustpal;
        if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
          custPal.maxFieldLen = truckvo.RFREQ.fscanlngth;
        }
        scrnUI.push(custPal);
      }

      if (truckvo.llASNpal) {
        truckvo = await this.applyASN(truckvo);
      }

      if (truckvo.lcDteTyp === 'N') {
        truckvo.lcDte = moment(truckvo.LOADIN.fbdate, 'YYYY-MM-DD').format(
          'MMDDYYYY',
        );

        truckvo.curOper = TruckReceiveState.MARK_PROCESS_QTY;

        const qty = getFields(TruckReceiveState.MARK_PROCESS_QTY);
        qty.badOneOfValidMsg = `${constant.QTY_TIE.trim()} ${truckvo.lnIntie
          } X ${truckvo.lnHigh} ${constant.OK_QUES.trim()}`;
        qty.justDisplay = `${truckvo.lnIntie * truckvo.lnHigh}`;

        if (truckvo.llASNpal && truckvo.llASNpalNoQty === false) {
          let tempqty = Number(truckvo.lcQty).toString();
          tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
          qty.defaultVal = tempqty;
          qty.value = tempqty;
        } else {
          qty.defaultVal = '';
          qty.value = '';
        }
        scrnUI.unshift(qty); // focusable field always in 0th index

        const codeDate = getFields(TruckReceiveState.SHOW_PROCESS_CDATE);
        codeDate.defaultVal = truckvo.lcDte;
        codeDate.value = truckvo.lcDte;
        scrnUI.push(codeDate);
        outKey = 'qty';
      } else {
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_DATE;
        outKey = truckvo.lcDteTyp === 'J' ? 'julinDate' : 'codeDate';
        const date = getFields(
          truckvo.lcDteTyp === 'J'
            ? TruckReceiveState.SHOW_PROCESS_JDATE
            : TruckReceiveState.SHOW_PROCESS_CDATE,
        );

        if (truckvo.llASNpal) {
          date.defaultVal =
            truckvo.lcDteTyp === 'J' ? truckvo.lcJdte : truckvo.lcDte;
          date.value =
            truckvo.lcDteTyp === 'J' ? truckvo.lcJdte : truckvo.lcDte;
        }
        scrnUI.unshift(date); // focusable field always in 0th index
      }

      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    } else {
      errMsg = constant.CUSTPAL_BLANK.trim();
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        infoMsg: '',
        data,
        scrnUI,
      }),
      getOutputFields(outKey),
      '',
      '',
      `${constant.F5_EXIT.trim()}`,
    );
  }

  printerSummary(truckvo: TruckReceiveVO): any[] {
    const scrnUi = [];
    const printerNum = getObjFields('printerNum');
    printerNum.defaultVal = truckvo.printerDefault;
    printerNum.value = truckvo.printerDefault;

    const verifyPID = getObjFields('verifyPID');

    const PIDLabel = getObjFields('PIDLabel');
    PIDLabel.defaultVal = truckvo.pcPalletToCheck;
    PIDLabel.value = truckvo.verifyPID;

    scrnUi.push(printerNum, PIDLabel, verifyPID);

    return scrnUi;
  }

  async applyASN(truckVo: TruckReceiveVO): Promise<TruckReceiveVO> {
    const truckvo = truckVo;
    let lcProd = '';
    // APPLY ASN INFORMATION
    if (truckvo.llASNpal) {
      let ediPal = await this.editPAlRepo().findOne({
        where: {
          fbatch: truckvo.lcBatch,
          fpalletid: truckvo.lcPal,
        },
        order: {
          fbatch: 'ASC',
          fpalletid: 'ASC',
        },
      });
      if (ediPal && ediPal.fpalletid.length > 0) {
        lcProd = ediPal.fproduct ? ediPal.fproduct : '';
        if (ediPal.fcodedte) {
          truckvo.lcDte = moment(ediPal.fcodedte, 'YYYY-MM-DD').format(
            'MMDDYYYY',
          );
          truckvo.lcJdte = this.RFDTOJ(truckvo.lcDte);
        }
        truckvo.lcLot =
          truckvo.lcKeyLot === 'Y' &&
            ediPal.flot &&
            ediPal.flot.trim().length > 0
            ? ediPal.flot
            : '';
        truckvo.lcQty = ediPal.fqty
          .toString()
          .trim()
          .padStart(4, '0');
        truckvo.pnExpectedAsnQty = ediPal.fqty;
      } else if (truckvo.lcHasCust === 'Y') {
        ediPal = await this.editPAlRepo().findOne({
          fbatch: truckvo.lcBatch,
          fpalletid: truckvo.lcCustpal,
        });
        if (ediPal) {
          lcProd = ediPal.fproduct ? ediPal.fproduct : '';
          if (ediPal.fcodedte) {
            truckvo.lcDte = moment(ediPal.fcodedte, 'YYYY-MM-DD').format(
              'MMDDYYYY',
            );
            truckvo.lcJdte = this.RFDTOJ(truckvo.lcDte);
          }
          truckvo.lcLot =
            truckvo.lcKeyLot === 'Y' &&
              ediPal.flot &&
              ediPal.flot.trim().length > 0
              ? ediPal.flot
              : '';
          truckvo.lcQty = ediPal.fqty
            .toString()
            .trim()
            .padStart(4, '0');
          truckvo.pnExpectedAsnQty = ediPal.fqty;
        }
      }
    }
    this.logger.debug(
      'Truck-receive -->',
      `ASN --> ${truckvo.lcDte}, ${truckvo.lcLot}, ${truckvo.lcQty}`,
    );
    return truckvo;
  }

  async processQty(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    let lcQty = 0;
    let llQty = 0;
    let outkey = 'qty';
    let scrnUI = [];
    let footerData = constant.F5_EXIT;
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_QTY_YN) {
      if (body.qtyYN?.toString().toUpperCase() === 'Y') {
        llQty = 2;
        lcQty = truckvo.lcQty !== '' ? Number(truckvo.lcQty) : 0;
      } else {
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_QTY;
        llQty = 0;
        lcQty = 0;
        truckvo.lcQty = '';
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        const qyn = getFields(TruckReceiveState.MARK_PROCESS_QTY_YN);
        qyn.avoidable = true;
        scrnUI.push(qyn);
        const q = getFields(TruckReceiveState.MARK_PROCESS_QTY);
        q.badOneOfValidMsg = `${constant.QTY_TIE.trim()} ${truckvo.lnIntie} X ${truckvo.lnHigh
          } ${constant.OK_QUES.trim()}`;
        q.justDisplay = `${truckvo.lnIntie * truckvo.lnHigh}`;
        if (truckvo.llASNpal && truckvo.llASNpalNoQty === false) {
          let tempqty = Number(truckvo.lcQty).toString();
          tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
          q.defaultVal = tempqty;
          q.value = tempqty;
        } else {
          q.defaultVal = '';
          q.value = '';
        }
        scrnUI.push(q);
        return new ResponseKeysDTO(
          plainToClass(PostResponseTruckReceiveDTO, {
            errMsg,
            infoMsg: '',
            curOper: truckvo.curOper,
            scrnUI,
          }),
          getOutFieldState(truckvo.curOper),
          '',
          '',
          `${constant.F5_EXIT}`,
        );
      }
    } else if (body.qty.toString() !== '') {
      if (body.qty >= 0) {
        lcQty = body.qty;
        if (truckvo.llQuickrcv && truckvo.lcQty === '0') {
          const STAGE = await this.stageRepo().findOne({
            where: {
              fcubedid: truckvo.lcPal,
            },
            order: {
              fcubedid: 'ASC',
            },
          });
          if (STAGE && STAGE?.floaddate !== undefined) {
            errMsg = constant.PALLETS_LOADED.trim();
            lcQty = 0;
          } else {
            llQty = 2;
          }
        } else {
          llQty = 2;
        }

        if (
          truckvo.pnExpectedAsnQty > 0 &&
          truckvo.pnExpectedAsnQty !== Number(lcQty)
        ) {
          truckvo.plUnmatchedAsnQty = true;
        }
      } else {
        errMsg = constant.QTY_NON_0.trim();
      }
    } else {
      errMsg = constant.QTY_EMPTY.trim();
    }

    if (
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_QTY &&
      lcQty !== truckvo.lnIntie * truckvo.lnHigh
    ) {
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_QTY_YN;
      const q = getFields(TruckReceiveState.MARK_PROCESS_QTY_YN);
      q.label = `${constant.QTY_TIE.trim()} ${truckvo.lnIntie} X ${truckvo.lnHigh
        } ${constant.OK_QUES.trim()}`;
      q.avoidable = false;
      scrnUI.push(q);
      truckvo.lcQty = lcQty.toString();
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          errMsg,
          infoMsg: '',
          curOper: truckvo.curOper,
          scrnUI,
        }),
        getOutFieldState(truckvo.curOper),
      );
    }

    let data;
    if (llQty > 0) {
      truckvo.lcQty = lcQty.toString();
      if (!truckvo.llUsedF6) {
        let lcIsblast;
        if (truckvo?.lcHasBlast?.trim() === 'Y') {
          const BLSTSTATUS = await this.blststatusRepo().findOne({
            where: {
              fcustcode: truckvo.LOADIN.fcustcode,
            },
            order: {
              fcustcode: 'ASC',
              fstatus: 'ASC',
            },
          });
          const EDI_LOG = await this.edilogRepo()
            .createQueryBuilder('e')
            .select('*')
            .where('e.fbatch+e.fproduct = :edi', {
              edi: truckvo.lcEdiReqBlastBatchProduct,
            })
            .getRawOne();
          const REQBLAST = await this.reqblastRepo()
            .createQueryBuilder('r')
            .select('*')
            .where('r.fbatch+r.fproduct = :req', {
              req: truckvo.lcReqBlastKey,
            })
            .getRawOne();

          let lcIsblast1 = truckvo.lcIsBlast1;
          if (
            truckvo.lcEdiControlReqBlast &&
            truckvo.lcEdiControlReqBlast.toUpperCase() === 'P' &&
            EDI_LOG
          ) {
            if (
              BLSTSTATUS &&
              `${truckvo.LOADIN.fcustcode}${EDI_LOG.fstatus}` ===
              `${BLSTSTATUS.fcustcode}${BLSTSTATUS.fstatus}`
            ) {
              lcIsblast1 = 'Y';
            }
          } else if (
            REQBLAST &&
            truckvo.lcEdiControlReqBlast.toUpperCase() !== 'P' &&
            truckvo.lcReqBlastKey ===
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
          truckvo.lcIsBlast = lcIsblast;
        }
      }

      if (!truckvo.llUsedF6 && truckvo.lcHasBlast === 'Y') {
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_BLAST;
        outkey = 'blast';
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        const b = getFields(TruckReceiveState.MARK_PROCESS_BLAST);
        b.defaultVal = truckvo.lcIsBlast1;
        b.value = truckvo.lcIsBlast1;
        b.readable = false;
        scrnUI.push(b);
        const q = getFields(TruckReceiveState.MARK_PROCESS_QTY_YN);
        q.avoidable = true;
        scrnUI.push(q);
      } else {
        await this.processHPP(fwho, truckvo);
        const q = getFields(TruckReceiveState.MARK_PROCESS_QTY_YN);
        q.avoidable = true;
        scrnUI.push(q);
        if (!truckvo.llUsedF6 && truckvo.llIsHPPIn) {
          const h = getFields(TruckReceiveState.MARK_PROCESS_HPP);
          h.value = truckvo.lcIsHPP;
          scrnUI.push(h);
        } else {
          const b = getFields(TruckReceiveState.MARK_PROCESS_BLAST);
          b.defaultVal = truckvo.lcIsBlast1;
          b.value = truckvo.lcIsBlast1;
          b.avoidable = false;
          scrnUI.push(b);
        }

        truckvo.curOper = this.findNextState(truckvo);
        if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
          scrnUI = [];
          data = { label: getLabelFields('assumeText') };
          footerData = `${constant.F7_DIMS}`;
          scrnUI.push(...this.summary2(truckvo));
          const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
            this.manager(),
            truckvo.lcCustCode,
            truckvo.lcProd,
            truckvo.lcBatch,
          );
          scrnUI.push(...dynamicAttributes);
        } else {
          outkey = 'lot';
          if (truckvo.lcKeyLot === 'Y') {
            const l = getFields(TruckReceiveState.MARK_PROCESS_LOT);
            if (truckvo.llASNpal) {
              l.defaultVal = truckvo.lcLot;
              l.value = truckvo.lcLot;
            }
            scrnUI.unshift(l);
          }
        }
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      errMsg = '';
    } else if (outkey === 'qty') {
      const q = getFields(TruckReceiveState.MARK_PROCESS_QTY);
      q.badOneOfValidMsg = `${constant.QTY_TIE.trim()} ${truckvo.lnIntie} X ${truckvo.lnHigh
        } ${constant.OK_QUES.trim()}`;
      q.justDisplay = `${truckvo.lnIntie * truckvo.lnHigh}`;
      if (truckvo.llASNpal && truckvo.llASNpalNoQty === false) {
        let tempqty = Number(truckvo.lcQty).toString();
        tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
        q.defaultVal = tempqty;
        q.value = tempqty;
      } else {
        q.defaultVal = '';
        q.value = '';
      }
      scrnUI.push(q);
    }
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
      const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
      q.defaultVal = truckvo.curTempVal;
      scrnUI.push(q);
    }
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE) {
      const q = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
      // scrnUI = [];
      scrnUI.push(q);
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  findNextState(truckvo: TruckReceiveVO) {
    const curOper = truckvo.curOper.toString();
    let result;
    if (
      (TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper) &&
      truckvo.lcKeyLot === 'Y'
    ) {
      result = TruckReceiveState.MARK_PROCESS_LOT;
    } else if (
      (TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper ||
        TruckReceiveState.MARK_PROCESS_LOT === curOper) &&
      truckvo.lcHasLot === 'Y'
    ) {
      result = TruckReceiveState.MARK_PROCESS_CLOT;
    } else if (
      (TruckReceiveState.MARK_PROCESS_QTY === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
        TruckReceiveState.MARK_PROCESS_LOT === curOper ||
        TruckReceiveState.MARK_PROCESS_CLOT === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper) &&
      truckvo.lcKeyEstb === 'Y'
    ) {
      result = TruckReceiveState.MARK_PROCESS_EST;
    } else if (
      (TruckReceiveState.MARK_PROCESS_LOT === curOper ||
        TruckReceiveState.MARK_PROCESS_CLOT === curOper ||
        TruckReceiveState.MARK_PROCESS_EST === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper) &&
      truckvo.lcKeyEstb === 'Y' &&
      !truckvo.llUsedF6
    ) {
      result = TruckReceiveState.MARK_PROCESS_SDATE;
    } else if (
      (TruckReceiveState.MARK_PROCESS_LOT === curOper ||
        TruckReceiveState.MARK_PROCESS_CLOT === curOper ||
        TruckReceiveState.MARK_PROCESS_SDATE === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY === curOper) &&
      truckvo.lcKeyRef === 'Y' &&
      !truckvo.llUsedF6
    ) {
      result = TruckReceiveState.MARK_PROCESS_REF;
    } else if (
      (TruckReceiveState.MARK_PROCESS_LOT === curOper ||
        TruckReceiveState.MARK_PROCESS_CLOT === curOper ||
        TruckReceiveState.MARK_PROCESS_REF === curOper ||
        TruckReceiveState.MARK_PROCESS_EST === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper ||
        TruckReceiveState.MARK_PROCESS_SDATE === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY === curOper) &&
      truckvo.lcKeyTmp === 'Y' &&
      !truckvo.llUsedF6
    ) {
      result = TruckReceiveState.MARK_PROCESS_TEMP;
    } else if (
      (TruckReceiveState.MARK_PROCESS_LOT === curOper ||
        TruckReceiveState.MARK_PROCESS_REF === curOper ||
        TruckReceiveState.MARK_PROCESS_CLOT === curOper ||
        TruckReceiveState.MARK_PROCESS_TEMP === curOper ||
        TruckReceiveState.MARK_PROCESS_EST === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper ||
        TruckReceiveState.MARK_PROCESS_SDATE === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY === curOper) &&
      truckvo.lcBbdtetype.trim() !== '' &&
      !truckvo.llUsedF6 &&
      (truckvo.lcBbdte.trim().length === 0 ||
        truckvo.lcBBJULIAN.trim().length === 0)
    ) {
      result =
        truckvo.lcBbdtetype.trim() === '1'
          ? TruckReceiveState.MARK_PROCESS_BB_JDATE
          : TruckReceiveState.MARK_PROCESS_BB_DATE;
    } else if (
      (TruckReceiveState.MARK_PROCESS_LOT === curOper ||
        TruckReceiveState.MARK_PROCESS_REF === curOper ||
        TruckReceiveState.MARK_PROCESS_CLOT === curOper ||
        TruckReceiveState.MARK_PROCESS_TEMP === curOper ||
        TruckReceiveState.MARK_PROCESS_BB_DATE === curOper ||
        TruckReceiveState.MARK_PROCESS_BLAST === curOper ||
        TruckReceiveState.MARK_PROCESS_BB_JDATE === curOper ||
        TruckReceiveState.MARK_PROCESS_EST === curOper ||
        TruckReceiveState.MARK_PROCESS_SDATE === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
        TruckReceiveState.MARK_PROCESS_QTY === curOper) &&
      truckvo.llIsConsCross
    ) {
      result = TruckReceiveState.MARK_PROCESS_CONSIGNEE;
    } else if (
      TruckReceiveState.MARK_PROCESS_QTY_YN === curOper ||
      TruckReceiveState.MARK_PROCESS_QTY === curOper ||
      TruckReceiveState.MARK_PROCESS_LOT === curOper ||
      TruckReceiveState.MARK_PROCESS_CLOT === curOper ||
      TruckReceiveState.MARK_PROCESS_BLAST === curOper ||
      TruckReceiveState.MARK_PROCESS_BLAST === curOper ||
      TruckReceiveState.MARK_PROCESS_BB_DATE === curOper ||
      TruckReceiveState.MARK_PROCESS_BB_JDATE === curOper ||
      TruckReceiveState.MARK_PROCESS_REF === curOper ||
      TruckReceiveState.MARK_PROCESS_SDATE === curOper ||
      TruckReceiveState.MARK_PROCESS_EST === curOper ||
      TruckReceiveState.MARK_PROCESS_REF === curOper ||
      TruckReceiveState.MARK_PROCESS_TEMP === curOper ||
      TruckReceiveState.MARK_PROCESS_BB_DATE === curOper ||
      TruckReceiveState.MARK_PROCESS_CONSIGNEE === curOper
    ) {
      result = TruckReceiveState.MARK_SEND_PALLET;
    } else {
      result = curOper;
    }
    return result;
  }

  async processBlast(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    let data = {};
    let footerData = constant.F5_EXIT;
    if (
      body.blast &&
      ['Y', 'N', ''].includes(body.blast.trim().toUpperCase())
    ) {
      let lcIsblast = body.blast.trim().toUpperCase();
      lcIsblast = lcIsblast === '' ? 'N' : lcIsblast;
      const [PHY_MST] = await this.manager().query(
        `BEGIN
            SELECT id, fisblast, fblasthrs
            FROM dbo.PHY_MST
            WHERE fpalletid = '${truckvo.lcPal}'
            order by fpalletid ASC ;
        END`,
      );
      // const PHY_MST: PhyMst = PHYMSTres[0];
      if (PHY_MST) {
        PHY_MST.fisblast = lcIsblast !== 'N';
        PHY_MST.fblasthrs = lcIsblast === 'N' ? 0 : truckvo.lnBlasthrs;
        await this.phymstRepo().save(PHY_MST);
      }
      truckvo.lcOldIsBlast = truckvo.lcIsBlast;
      truckvo.lcIsBlast = lcIsblast;
      truckvo.lcIsBlast1 = lcIsblast;

      await this.processHPP(fwho, truckvo);
      truckvo.curOper = this.findNextState(truckvo);
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
        const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
        q.defaultVal = truckvo.curTempVal;
        scrnUI.push(q);
      }
      if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS}`;
        scrnUI.push(...this.summary2(truckvo));
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
          this.manager(),
          truckvo.lcCustCode,
          truckvo.lcProd,
          truckvo.lcBatch,
        );
        scrnUI.push(...dynamicAttributes);
      } else {
        if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_LOT) {
          const lot = getFields(TruckReceiveState.MARK_PROCESS_LOT);
          lot.defaultVal = truckvo.lcLot;
          scrnUI.push(lot);
        } else {
          const o = getFields(truckvo.curOper);
          scrnUI.push(o);
        }
        if (!truckvo.llUsedF6 && truckvo.llIsHPPIn) {
          const h = getFields(TruckReceiveState.MARK_PROCESS_HPP);
          h.value = truckvo.lcIsHPP;
          scrnUI.push(h);
          const b = getFields(TruckReceiveState.MARK_PROCESS_BLAST);
          b.defaultVal = truckvo.lcIsBlast1;
          b.value = truckvo.lcIsBlast1;
          b.avoidable = true;
          scrnUI.push(b);
        } else {
          const b = getFields(TruckReceiveState.MARK_PROCESS_BLAST);
          b.defaultVal = truckvo.lcIsBlast1;
          b.value = truckvo.lcIsBlast1;
          b.avoidable = false;
          scrnUI.push(b);
        }
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    } else {
      errMsg = constant.BLAST_MUST_YN.trim();
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processHPP(fwho: string, truckVo: TruckReceiveVO): Promise<void> {
    const truckvo = truckVo;

    if (!truckvo.llUsedF6 && truckvo.llIsHPPIn) {
      const lcIsHPP = 'Y';
      const [PHY_MST] = await this.manager().query(`
      BEGIN
          SELECT
          id, TRIM(fpalletid) fpalletid, TRIM(fcustpalid) fcustpalid,
          TRIM(fcustcode) fcustcode, fshipstat, fqty, TRIM(ftrack) ftrack,
          TRIM(fserial) fserial, TRIM(fhold) fhold, frectype, fishpp
          FROM dbo.PHY_MST
          WHERE fpalletid = '${truckvo.lcPal}'
          order by fpalletid ASC ;
      END`);

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
        await this.phymstRepo().save(PHY_MST);
      }
      truckvo.lcIsHPP = lcIsHPP;
      truckvo.lcOldisHPP = lcIsHPP;
    }
  }

  async processLotNo(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    let data = {};
    let footerData = constant.F5_EXIT;
    // line 1521 - ** GET LOT NUMBER

    if (truckvo.lcKeyLot === 'Y') {
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
          (truckvo.lcCustCode.trim() === '0008873' ||
            truckvo.lcCustCode.trim() === '0010562')
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
          truckvo.lcLot = lcLot;
          truckvo.lcOldLot = lcLot;

          if (truckvo.plAutoDateForProdLot && truckvo.lcKeyLot === 'Y') {
            const rfLot = await this.storedProceduresNewService.getGetdatesfromproductandlot(
              {
                inBatch: truckvo.lcBatch,
                inLot: truckvo.lcLot,
                inProduct: truckvo.lcProd,
                outBbcodedate: '',
                outBbjuliandate: '',
                outCodedate: '',
                outJuliandate: '',
              },
            );

            if (rfLot && rfLot.output) {
              const lcdte =
                truckvo.lcDteTyp === 'J'
                  ? rfLot.output.out_juliandate.length > 0
                    ? rfLot.output.out_juliandate.trim()
                    : truckvo.lcDte
                  : rfLot.output.out_codedate.length > 0
                    ? rfLot.output.out_codedate.trim()
                    : truckvo.lcDte;
              const lcjdte =
                rfLot.output.out_juliandate.length > 0
                  ? rfLot.output.out_juliandate.trim()
                  : truckvo.lcJdte;
              const lcbbdte =
                truckvo.lcBbdtetype === '1'
                  ? rfLot.output.out_bbjuliandate.length > 0
                    ? rfLot.output.out_bbjuliandate.trim()
                    : truckvo.lcBbdte
                  : rfLot.output.out_bbcodedate.length > 0
                    ? rfLot.output.out_bbcodedate.trim()
                    : truckvo.lcBbdte;
              const lcBBJULIAN =
                rfLot.output.out_bbjuliandate.length > 0
                  ? rfLot.output.out_bbjuliandate.trim()
                  : truckvo.lcBBJULIAN;
              this.logger.debug(
                'Truck-receive -->',
                `lot dates --> ${lcdte}, ${lcjdte}, ${lcbbdte}, ${lcBBJULIAN}`,
              );
            }
          }

          truckvo.curOper = this.findNextState(truckvo);
          if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
            const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
            q.defaultVal = truckvo.curTempVal;
            scrnUI.push(q);
          }
          if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
            data = { label: getLabelFields('assumeText') };
            footerData = `${constant.F7_DIMS}`;
            scrnUI.push(...this.summary2(truckvo));
            const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
              this.manager(),
              truckvo.lcCustCode,
              truckvo.lcProd,
              truckvo.lcBatch,
            );
            scrnUI.push(...dynamicAttributes);
          } else if (
            truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE
          ) {
            const CODE2 = (truckvo.CODE2 as unknown) as Code2;
            const lcConscode =
              truckvo.plAutoFillConsignee && CODE2.fproduct.length > 3
                ? CODE2.fproduct.slice(0, 3)
                : '';
            const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
            c.label = truckvo.pnHandKeyConsigneeCross
              ? constant.CONSIGNEE.trim()
              : constant.SCAN_CONSIGNEE.trim();
            c.defaultVal = lcConscode;
            c.value = lcConscode;
            c.isScanable = truckvo.pnHandKeyConsigneeCross;
            scrnUI.push(c);
          } else if (
            truckvo.llASNpal &&
            truckvo.curOper === TruckReceiveState.MARK_PROCESS_REF
          ) {
            let ediPal = await this.editPAlRepo().findOne({
              where: {
                fbatch: truckvo.lcBatch,
                fpalletid: truckvo.lcPal,
              },
              order: {
                fbatch: 'ASC',
                fpalletid: 'ASC',
              },
            });

            if (ediPal && ediPal.fpalletid.length > 0) {
              truckVo.lcRef = ediPal?.flotref ? ediPal?.flotref?.trim() : '';
              truckvo.lcBbdte = ediPal?.fbbcodedte
                ? moment(ediPal?.fbbcodedte, 'YYYY-MM-DD').format('MMDDYYYY')
                : '';
            }
            const c = getFields(TruckReceiveState.MARK_PROCESS_REF);
            c.label = constant.REF.trim();
            c.defaultVal = truckVo.lcRef;
            c.value = truckVo.lcRef;
            scrnUI.push(c);
          }
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
          errMsg = '';
        } else {
          errMsg = constant.LOT_NOT_BLANK.trim();
        }
      } else {
        errMsg = constant.LOT_NOT_BLANK.trim();
      }
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        infoMsg: '',
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processCustLotNo(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    let data = {};
    let footerData = constant.F5_EXIT;

    // line 1694 - ** GET CUSTOMER LOT NUMBER
    let lcClot = '';
    if (body.clot && body.clot.trim().length > 0) {
      lcClot = body.clot.trim().toUpperCase();
      truckvo.lcClot = lcClot;
      truckvo.curOper = this.findNextState(truckvo);
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
        const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
        q.defaultVal = truckvo.curTempVal;
        scrnUI.push(q);
      }
      if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS}`;
        scrnUI.push(...this.summary2(truckvo));
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
          this.manager(),
          truckvo.lcCustCode,
          truckvo.lcProd,
          truckvo.lcBatch,
        );
        scrnUI.push(...dynamicAttributes);
      } else if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE) {
        const CODE2 = (truckvo.CODE2 as unknown) as Code2;
        const lcConscode =
          truckvo.plAutoFillConsignee && CODE2.fproduct.length > 3
            ? CODE2.fproduct.slice(0, 3)
            : '';
        const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
        c.label = truckvo.pnHandKeyConsigneeCross
          ? constant.CONSIGNEE.trim()
          : constant.SCAN_CONSIGNEE.trim();
        c.defaultVal = lcConscode;
        c.value = lcConscode;
        c.isScanable = truckvo.pnHandKeyConsigneeCross;
        scrnUI.push(c);
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      errMsg = '';
    } else {
      errMsg = constant.CLOT_NOT_BLANK.trim();
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processEST(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    let data = {};
    let footerData = constant.F5_EXIT;
    // line 1825 - ** GET ESTABLISHMENT NUMBER
    if (truckvo.lcKeyEstb === 'Y' && !truckvo.llUsedF6) {
      let lcEstb = '';
      if (body.estb && body.estb.trim().length > 0) {
        lcEstb = body.estb.trim().toUpperCase();
        truckvo.lcEstb = lcEstb;

        truckvo.curOper = this.findNextState(truckvo);
        if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
          const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
          q.defaultVal = truckvo.curTempVal;
          scrnUI.push(q);
        }
        if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
          data = { label: getLabelFields('assumeText') };
          footerData = `${constant.F7_DIMS}`;
          scrnUI.push(...this.summary2(truckvo));
          const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
            this.manager(),
            truckvo.lcCustCode,
            truckvo.lcProd,
            truckvo.lcBatch,
          );
          scrnUI.push(...dynamicAttributes);
        } else if (
          truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE
        ) {
          const CODE2 = (truckvo.CODE2 as unknown) as Code2;
          const lcConscode =
            truckvo.plAutoFillConsignee && CODE2.fproduct.length > 3
              ? CODE2.fproduct.slice(0, 3)
              : '';
          const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
          c.label = truckvo.pnHandKeyConsigneeCross
            ? constant.CONSIGNEE.trim()
            : constant.SCAN_CONSIGNEE.trim();
          c.defaultVal = lcConscode;
          c.value = lcConscode;
          c.isScanable = truckvo.pnHandKeyConsigneeCross;
          scrnUI.push(c);
        }
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      } else {
        errMsg = constant.EST_NOT_BLANK.trim();
      }
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processSDate(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    let data = {};
    let footerData = constant.F5_EXIT;
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
            errMsg = constant.INVALID_YEAR.trim();
          } else if (errMsg === '' && !(lnslday >= 1 && lnslday <= 366)) {
            errMsg = constant.INVALID_DAY.trim();
          } else if (errMsg === '' && ldSlpdate.diff(moment(), 'hours') > 0) {
            errMsg = constant.SLAUGH_DTE.trim();
          }
        } else if (lcSlaughdte.length === 8) {
          // && IS A GREGORIAN DATE
          const ldSlpdate = moment(body.sDte, 'MMDDYYYY');
          const lnslyear = ldSlpdate.year();
          const lnslday = ldSlpdate.date();
          const lnslmonth = ldSlpdate.month();
          const y: number = moment().year();
          if (!(lnslyear >= y - 2 && lnslyear <= y)) {
            errMsg = constant.INVALID_YEAR.trim();
          } else if (errMsg === '' && !(lnslday >= 1 && lnslday <= 31)) {
            errMsg = constant.INVALID_DAY.trim();
          } else if (errMsg === '' && !(lnslmonth >= 0 && lnslmonth <= 11)) {
            errMsg = constant.INVALID_MONTH.trim();
          } else if (errMsg === '' && ldSlpdate.diff(moment(), 'hours') > 0) {
            errMsg = constant.SLAUGH_DTE.trim();
          }
        } else {
          lcSlaughdte = '';
        }
      } else {
        errMsg = constant.DTE_LENGTH.trim();
      }
    } else {
      lcSlaughdte = '';
    }

    if (errMsg === '') {
      truckvo.lcSlaughDte = lcSlaughdte;
      truckvo.curOper = this.findNextState(truckvo);
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
        const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
        q.defaultVal = truckvo.curTempVal;
        scrnUI.push(q);
      }
      if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS}`;
        scrnUI.push(...this.summary2(truckvo));
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
          this.manager(),
          truckvo.lcCustCode,
          truckvo.lcProd,
          truckvo.lcBatch,
        );
        scrnUI.push(...dynamicAttributes);
      } else if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE) {
        const CODE2 = (truckvo.CODE2 as unknown) as Code2;
        const lcConscode =
          truckvo.plAutoFillConsignee && CODE2.fproduct.length > 3
            ? CODE2.fproduct.slice(0, 3)
            : '';
        const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
        c.label = truckvo.pnHandKeyConsigneeCross
          ? constant.CONSIGNEE.trim()
          : constant.SCAN_CONSIGNEE.trim();
        c.defaultVal = lcConscode;
        c.value = lcConscode;
        c.isScanable = truckvo.pnHandKeyConsigneeCross;
        scrnUI.push(c);
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processRef(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    const errMsg = '';
    let footerData = constant.F5_EXIT;
    let data = {};

    let lcRef = '';
    if (body.ref && body.ref.trim().length > 0) {
      lcRef = body.ref.trim().slice(0, 15);
    }
    truckvo.lcRef = lcRef;
    truckvo.curOper = this.findNextState(truckvo);
    const scrnUI = [];
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
      const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
      q.defaultVal = truckvo.curTempVal;
      scrnUI.push(q);
    }
    if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
      data = { label: getLabelFields('assumeText') };
      footerData = `${constant.F7_DIMS}`;
      scrnUI.push(...this.summary2(truckvo));
      const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
        this.manager(),
        truckvo.lcCustCode,
        truckvo.lcProd,
        truckvo.lcBatch,
      );
      scrnUI.push(...dynamicAttributes);
    } else if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE) {
      const CODE2 = (truckvo.CODE2 as unknown) as Code2;
      const lcConscode =
        truckvo.plAutoFillConsignee && CODE2.fproduct.length > 3
          ? CODE2.fproduct.slice(0, 3)
          : '';
      const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
      c.label = truckvo.pnHandKeyConsigneeCross
        ? constant.CONSIGNEE.trim()
        : constant.SCAN_CONSIGNEE.trim();
      c.defaultVal = lcConscode;
      c.value = lcConscode;
      c.isScanable = truckvo.pnHandKeyConsigneeCross;
      scrnUI.push(c);
    }
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processTemp(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    const errMsg = '';
    let footerData = constant.F5_EXIT;
    let data = {};

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
    truckvo.lcTemp = lcTemp;
    truckvo.curTempVal = lcTemp;
    truckvo.curOper = this.findNextState(truckvo);
    const scrnUI = [];
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
      const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
      q.defaultVal = truckvo.curTempVal;
      scrnUI.push(q);
    }
    if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
      data = { label: getLabelFields('assumeText') };
      footerData = `${constant.F7_DIMS} `;
      scrnUI.push(...this.summary2(truckvo));
      const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
        this.manager(),
        truckvo.lcCustCode,
        truckvo.lcProd,
        truckvo.lcBatch,
      );
      scrnUI.push(...dynamicAttributes);
    } else if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE) {
      const CODE2 = (truckvo.CODE2 as unknown) as Code2;
      const lcConscode =
        truckvo.plAutoFillConsignee && CODE2.fproduct.length > 3
          ? CODE2.fproduct.slice(0, 3)
          : '';
      const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
      c.label = truckvo.pnHandKeyConsigneeCross
        ? constant.CONSIGNEE.trim()
        : constant.SCAN_CONSIGNEE.trim();
      c.defaultVal = lcConscode;
      c.value = lcConscode;
      c.isScanable = truckvo.pnHandKeyConsigneeCross;
      scrnUI.push(c);
    } else if (
      truckvo.llASNpal &&
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_BB_DATE
    ) {
      const c = getFields(TruckReceiveState.MARK_PROCESS_BB_DATE);
      c.label = constant.BEST_B4_DATE.trim();
      let date =
        truckvo.lcBbdtetype.trim() === '1'
          ? truckvo.lcJdte
          : truckvo.lcBbdte !== ''
            ? moment(truckvo.lcBbdte, 'MMDDYYYY').format('MM/DD/YYYY')
            : truckvo.lcBbdte;
      c.defaultVal = date;
      c.value = date;
      scrnUI.push(c);
    } else if (
      truckvo.llASNpal &&
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_BB_JDATE
    ) {
      const c = getFields(TruckReceiveState.MARK_PROCESS_BB_JDATE);
      c.label = constant.BEST_B4_JULIAN.trim();
      let date =
        truckvo.lcBbdtetype.trim() === '1'
          ? truckvo.lcJdte
          : truckvo.lcBbdte !== ''
            ? moment(truckvo.lcBbdte, 'MMDDYYYY').format('MM/DD/YYYY')
            : truckvo.lcBbdte;
      c.defaultVal = date;
      c.value = date;
      scrnUI.push(c);
    }
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processBBdate(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    const CODE2 = (truckvo.CODE2 as unknown) as Code2;
    let footerData = constant.F5_EXIT;
    let data = {};
    if (truckvo.lcBbdtetype === '1') {
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
            .slice(0, 2)}${lcDte} `
          : lcDte;
      if (l === 0) {
        errMsg = constant.DATE_EMPTY.trim();
      } else if (body.bbjDte && l === 7) {
        const ldcdate = moment(lcDte, 'YYYYDDD');
        const isValid = moment(lcDte, 'YYYYDDD').isValid(); // check valid julian Format or not
        const lncday = Number(lcDte.slice(4, 7));
        const d = moment();
        const lneDate =
          truckvo.lcDteTyp === 'J'
            ? moment(this.RFJTOD(truckvo.lcDte), 'MMDDYYYY')
            : moment(truckvo.lcDte, 'MMDDYYYY');
        lneDate.add(CODE2.fshelflife, 'days');
        if (
          !ldcdate.isBetween(
            moment(lneDate)
              .subtract(truckvo.lnYearsback, 'year')
              .subtract(1, 'days'),
            moment(lneDate)
              .add(1, 'year')
              .add(1, 'days'),
          ) &&
          isValid
        ) {
          errMsg = constant.INVALID_JUL_YR.trim();
          const lccdterr = `Batch ${truckvo.lcBatch} \n Pallet ${truckvo.lcPal
            } had Julian Date ${lcDte} put in.This date was Incorrect as the year was not within ${truckvo.lnYearsback
              .toString()
              .trim()} yr back or 1 yr forward of ${d.format(
                'MM/DD/YYYY',
              )} \n  PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
            } `;
          await this.WRITEINVCONTROL(
            fwho,
            truckvo,
            'JULIAN YEAR IS INCORRECT',
            lccdterr,
            true,
          );
        } else if (errMsg === '' && !(lncday >= 1 && lncday <= 366)) {
          errMsg = constant.INVALID_JUL_DAY.trim();
          const lccdterr = `Batch ${truckvo.lcBatch} \n Pallet ${truckvo.lcPal} had Julian Date ${lcDte} put in.This date was Incorrect as the day was not between 1 and 366. \n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife} `;
          await this.WRITEINVCONTROL(
            fwho,
            truckvo,
            'JULIAN DAY IS INCORRECT',
            lccdterr,
            true,
          );
        } /* NOT executing EXP_DATE
        else if (errMsg === '' && ldcdate.diff(moment(), 'days') < 30) {
          errMsg = constant.EXP_DATE;
          const lccdterr = `Batch ${ truckvo.lcBatch } \n Pallet ${ truckvo.lcPal } had Best Before Julian Date ${ lcDte } put in.\n The Best Before date is ${ ldcdate.format('MM/DD/YYYY') }  This date is a problem as the Expiration date is < 30 days.\n PickCode is ${ CODE2.fpickcode } Shelflife is ${ CODE2.fshelflife } `;
          await this.WRITEINVCONTROL(fwho, truckvo, "JULIAN EXPIRATION < 30", lccdterr, false);
        } */ else {
          truckvo.lcBBJULIAN = body.bbjDte;
          truckvo.lcBbdte = ldcdate.format('MMDDYYYY'); // todao check code later lc_BBJULIAN > rjod > MMDDYYYY
        }
      } else {
        errMsg = constant.INVALID_JUL_DATE.trim();
        const lccdterr = `Batch ${truckvo.lcBatch} \n Pallet ${truckvo.lcPal} had Julian Date ${lcDte} put in.This date was Incorrect as it was not 7 Characters long.\n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife} `;
        await this.WRITEINVCONTROL(
          fwho,
          truckvo,
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
        errMsg = constant.DATE_EMPTY.trim();
      } else if (errMsg === '' && lcDte && (l === 6 || l === 8)) {
        const ldcdate =
          lcDte.length === 6
            ? moment(lcDte, 'MMDDYY')
            : moment(lcDte, 'MMDDYYYY');
        const d = moment(ldcdate, 'MMDDYYYY').isValid();
        if (d) {
          const lneDate =
            truckvo.lcDteTyp === 'J'
              ? moment(this.RFJTOD(truckvo.lcDte), 'MMDDYYYY')
              : moment(truckvo.lcDte, 'MMDDYYYY');
          lneDate.add(CODE2.fshelflife, 'days');
          if (
            !ldcdate.isBetween(
              moment(lneDate)
                .subtract(truckvo.lnYearsback, 'year')
                .subtract(1, 'days'),
              moment(lneDate)
                .add(1, 'year')
                .add(1, 'days'),
            )
          ) {
            errMsg = constant.INVALID_BEST_DATE.trim();
            const lcCdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} had  Best Before Code Date ${ldcdate
                .format('MMDDYYYY')
                .toString()} put in.This date was Incorrect as the date was not between ${moment()
                  .subtract(1, 'year')
                  .format('MM/DD/YYYY')
                  .toString()} and ${moment()
                    .add(1, 'year')
                    .format('MM/DD/YYYY')
                    .toString()} \n PickCode is  ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
              } `;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
              'BEST BEFORE DATE YEAR IS INCOR',
              lcCdterr,
              true,
            );
          }
          truckvo.lcBbdte = ldcdate.format('MMDDYYYY');
        } else {
          errMsg = constant.INVALID_BEST_DATE.trim();
        }
      } else {
        errMsg = constant.INVALID_BEST_DATE.trim();
      }
    }

    if (errMsg === '') {
      /**
       * Added this code for enter julian expire in inventory control
       */
      let ldcdate = moment();
      if (truckvo.lcBbdtetype === '1') {
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
        const lccdterr = `Batch ${truckvo.lcBatch} \n Pallet ${truckvo.lcPal
          } had Best Before Julian Date ${ldcdate} put in.\n The Best Before date is ${ldcdate.format(
            'MM/DD/YYYY',
          )}  This date is a problem as the Expiration date is < 30 days.\n PickCode is ${CODE2.fpickcode
          } Shelflife is ${CODE2.fshelflife} `;
        await this.WRITEINVCONTROL(
          fwho,
          truckvo,
          'JULIAN EXPIRATION < 30',
          lccdterr,
          false,
        );
      }

      truckvo.lcOldbbdte = truckvo.lcBbdte;
      truckvo.curOper = this.findNextState(truckvo);
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
        const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
        q.defaultVal = truckvo.curTempVal;
        scrnUI.push(q);
      }
      if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
        data = { label: getLabelFields('assumeText') };
        footerData = `${constant.F7_DIMS} `;
        scrnUI.push(...this.summary2(truckvo));
        const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
          this.manager(),
          truckvo.lcCustCode,
          truckvo.lcProd,
          truckvo.lcBatch,
        );
        scrnUI.push(...dynamicAttributes);
      } else if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_CONSIGNEE) {
        const lcConscode =
          truckvo.plAutoFillConsignee && CODE2.fproduct.length > 3
            ? CODE2.fproduct.slice(0, 3)
            : '';
        const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
        c.label = truckvo.pnHandKeyConsigneeCross
          ? constant.CONSIGNEE.trim()
          : constant.SCAN_CONSIGNEE.trim();
        c.defaultVal = lcConscode;
        c.value = lcConscode;
        c.isScanable = truckvo.pnHandKeyConsigneeCross;
        scrnUI.push(c);
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processConsignee(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const scrnUI = [];
    let data = {};
    let footerData = constant.F5_EXIT;
    if (body.consig && body.consig.trim().length > 0) {
      if (await this.validConsignee(body.consig)) {
        truckvo.lcConscode = body.consig.trim();
        truckvo.curOper = this.findNextState(truckvo);
        if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_TEMP) {
          const q = getFields(TruckReceiveState.MARK_PROCESS_TEMP);
          q.defaultVal = truckvo.curTempVal;
          scrnUI.push(q);
        }
        if (truckvo.curOper === TruckReceiveState.MARK_SEND_PALLET) {
          data = { label: getLabelFields('assumeText') };
          footerData = `${constant.F7_DIMS} `;
          scrnUI.push(...this.summary2(truckvo));
          const dynamicAttributes = await this.dynamicAttributesService.checkAndMapDynamicAttributes(
            this.manager(),
            truckvo.lcCustCode,
            truckvo.lcProd,
            truckvo.lcBatch,
          );
          scrnUI.push(...dynamicAttributes);
        }
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      } else {
        truckvo.lcConscode = '';
        errMsg = truckvo.pnHandKeyConsigneeCross
          ? constant.ENTER_VALID_CONSIGNEE.trim()
          : constant.SCAN_VALID_CONSIGNEE.trim();
        const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
        c.label = truckvo.pnHandKeyConsigneeCross
          ? constant.CONSIGNEE.trim()
          : constant.SCAN_CONSIGNEE.trim();
        c.defaultVal = body.consig;
        c.value = body.consig;
        c.isScanable = truckvo.pnHandKeyConsigneeCross;
        scrnUI.push(c);
      }
    } else {
      truckvo.lcConscode = '';
      errMsg = truckvo.pnHandKeyConsigneeCross
        ? constant.ENTER_VALID_CONSIGNEE.trim()
        : constant.SCAN_VALID_CONSIGNEE.trim();
      const c = getFields(TruckReceiveState.MARK_PROCESS_CONSIGNEE);
      c.label = truckvo.pnHandKeyConsigneeCross
        ? constant.CONSIGNEE.trim()
        : constant.SCAN_CONSIGNEE.trim();
      c.defaultVal = '';
      c.value = '';
      c.isScanable = truckvo.pnHandKeyConsigneeCross;
      scrnUI.push(c);
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footerData,
    );
  }

  async processSendPallet(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;

    //  line 2270 - SEND PALLET INFO?
    truckvo.pcPalletToCheck = truckvo.lcPal;
    if (body.sndPal && ['Y', ''].includes(body.sndPal.trim().toUpperCase())) {
      truckvo.lnIntie = body.ti && body.ti > 0 ? body.ti : 0;
      truckvo.pnHeight = body.height && body.height > 0 ? body.height : 0;
      truckvo.pnWidth = body.width && body.width > 0 ? body.width : 0;
      truckvo.pnLength = body.lngth && body.lngth > 0 ? body.lngth : 0;
      return this.INCREATE(fwho, truckvo, body, constant);
    } else if (
      body.sndPal &&
      ['N', ''].includes(body.sndPal.trim().toUpperCase()) &&
      ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
    ) {
      const infoMsg = constant.DATA_NOT_SENT.trim();
      const PHY_MSTresult = await this.manager().query(
        `BEGIN SELECT id, ftrack, fqty FROM dbo.PHY_MST WHERE fpalletid = '${truckvo.lcPal}' order by fpalletid ASC; END`,
      );
      const PHY_MST: PhyMst = PHY_MSTresult[0];
      if (
        PHY_MST &&
        PHY_MST.ftrack.slice(7, 10).trim() === '' &&
        PHY_MST.fqty === 0
      ) {
        await this.manager().query(
          `BEGIN  DELETE FROM[dbo].[PHY_MST] WHERE id = ${PHY_MST.id}; END`,
        );
      }
      truckvo.lcPal = '';
      return await this.processNavigateToPalletIdScreen(
        fwho,
        truckvo.LOADIN?.fconfirmnm,
        truckvo,
        constant,
        infoMsg,
      );
    }
    const infoMsg = constant.DATA_NOT_SENT.trim();
    const CONFIG = (truckvo.CONFIG as unknown) as Config;
    const glOfcputflag = CONFIG?.ofcputflag === true;
    if (truckvo.lcPal && truckvo.lcPal.length > 0) {
      const PHY_MSTresult = await this.manager().query(
        `BEGIN SELECT id, ftrack, fqty FROM dbo.PHY_MST WHERE fpalletid = '${truckvo.lcPal}' order by fpalletid ASC; END`,
      );
      const PHY_MST: PhyMst = PHY_MSTresult[0];
      if (
        PHY_MST &&
        PHY_MST.ftrack.slice(7, 10).trim() === '' &&
        PHY_MST.fqty === 0
      ) {
        const lcInoldloc = PHY_MST.flocation;
        // await this.phymstRepo().delete({ id: PHY_MST.id });
        await this.manager().query(
          `BEGIN  DELETE FROM[dbo].[PHY_MST] WHERE id = ${PHY_MST.id}; END`,
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
    truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD; // In truck receive it will go prod screen which is second screen
    truckvo.lcPal = '';
    truckvo.plUsedF8 = false;
    truckVo.isSSCCPallet = false;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

    const scrnUI: any = [];
    const prod = getFields(TruckReceiveState.MARK_PROCESS_PROD);
    prod.hideUntilEnabled = false;
    scrnUI.push(prod);

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg,
        curOper: truckvo.curOper,
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT.trim()} `,
    );
  }

  async processPalletType(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    const checkXdock = await this.checkCrossDock(fwho, truckvo, constant);
    if (
      body.palType &&
      body.palType.trim().length > 0 &&
      (await this.InmanPalletTypeIngestion(
        truckvo,
        truckvo.lcPal,
        body.palType,
      ))
    ) {
      truckvo.curOper = await this.processPallHist(fwho, truckvo, constant);
    } else {
      errMsg = constant.PALLET_SELECT.trim();
    }
    const scrnUI: any = [];

    if (
      truckvo.quickRec &&
      truckvo.quickRec.fquickrcv?.trim() === 'D' &&
      checkXdock.length
    ) {
      const [fdoornum, crossdocktype, cdobatch] = checkXdock;
      truckvo.fdoornum = fdoornum;
      truckvo.crossDockType = crossdocktype;
      truckvo.cdoBatch = cdobatch;
      return await this.infoMessageScreen(fwho, {}, truckvo, constant);
    }
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD) {
      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.hideUntilEnabled = false;
      scrnUI.push(prodField);
    }

    const data =
      truckvo.quickRec && ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
        ? { batch: '' }
        : { batch: truckvo.lcBatch };
    let footer = `${constant.F5_EXIT} `;
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET) {
      footer = ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
        ? `${constant.F5_EXIT} `
        : truckvo.lineageFreightManagement
          ? `${constant.F5_EXIT} `
          : `${constant.F5_EXIT} ~${constant.F8_LABL} `;
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      footer,
    );
  }

  async processPallHist(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
  ): Promise<string> {
    const truckvo = truckVo;
    let result = '';

    const PALLHIST = new Pallhist();
    PALLHIST.fworktype = 'RECEIVE';
    PALLHIST.fpalletid = truckvo.lcPal;
    PALLHIST.flocfrom = 'WALK';
    PALLHIST.flocto = truckvo.llQuickrcv ? 'UNASSIGNEQ' : 'UNASSIGNED';
    PALLHIST.foperid = fwho;
    PALLHIST.fdatestamp = new Date(this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS'));
    PALLHIST.fequipid = '';
    PALLHIST.fhandpal = false;
    PALLHIST.fhandloc = false;
    PALLHIST.fcustcode = truckvo.LOADIN.fcustcode;
    PALLHIST.fqty = Number.isNaN(truckvo.lcQty) ? 0 : Number(truckvo.lcQty);
    PALLHIST.fbatch = truckvo.LOADIN.fbatch;
    await this.pallhistRepo().save(PALLHIST);

    const [lmscan1] = await this.manager().query(
      `BEGIN
      SELECT * FROM LMSCAN WHERE PALLETID = '${truckvo.lcPal}'
      END`,
    );
    if (!lmscan1) {
      const lmscan = new Lmscan();
      lmscan.operatorid = fwho;
      lmscan.palletid = truckvo.lcPal;
      lmscan.firstloc = '';
      lmscan.origloc = 'WALK';
      lmscan.machserial = '';
      lmscan.roomloc = '';
      lmscan.active = false;
      lmscan.assignment = false;
      lmscan.droploc = '';
      lmscan.stage = '';
      lmscan.worktype = 'RECEIVE';
      lmscan.iscomplete = 'N';
      lmscan.datetime = new Date(this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS'));
      await this.lmscanRepo().save(lmscan);
    }

    if (truckvo.llIsConsCross) {
      await this.addUpdateConsCross(truckvo.lcPal, truckvo.lcConscode);
    }

    if (await this.CheckForStackable(truckvo.lcBatch, truckvo.lcPal)) {
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_GET_MOD;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      result = truckvo.curOper;
      return result;
    }

    const config = (truckvo.CONFIG as unknown) as Config;
    const glPutDuringRec = config ? config.putAwayDuringReceiving : false;
    if (glPutDuringRec) {
      truckvo.pcPutAway = 'N';
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PUT_AWAY;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      result = truckvo.curOper;
      return result;
    }

    await this.processLastPallet(fwho, truckvo, constant);
    result = truckvo.curOper;
    return result;
  }

  async processPallHistQuickRec(
    fwho: string,
    truckVo: TruckReceiveVO,
  ): Promise<string> {
    const truckvo = truckVo;
    let result = '';
    const PALLHIST = new Pallhist();
    PALLHIST.fworktype = 'RECEIVE';
    PALLHIST.fpalletid = truckvo.lcPal;
    PALLHIST.flocfrom = 'WALK';
    PALLHIST.flocto = truckvo.llQuickrcv ? 'UNASSIGNEQ' : 'UNASSIGNED';
    PALLHIST.foperid = fwho;
    PALLHIST.fdatestamp = new Date(this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS'));
    PALLHIST.fequipid = '';
    PALLHIST.fhandpal = false;
    PALLHIST.fhandloc = false;
    PALLHIST.fcustcode = truckvo.LOADIN.fcustcode;
    PALLHIST.fqty = Number.isNaN(truckvo.lcQty) ? 0 : Number(truckvo.lcQty);
    PALLHIST.fbatch = truckvo.LOADIN.fbatch;
    await this.pallhistRepo().save(PALLHIST);
    const lmscan1 = await this.lmscanRepo().findOne({
      palletid: truckvo.lcPal,
    });
    if (!lmscan1) {
      const lmscan = new Lmscan();
      lmscan.operatorid = fwho;
      lmscan.palletid = truckvo.lcPal;
      lmscan.firstloc = '';
      lmscan.origloc = 'WALK';
      lmscan.machserial = '';
      lmscan.roomloc = '';
      lmscan.active = false;
      lmscan.assignment = false;
      lmscan.droploc = '';
      lmscan.stage = '';
      lmscan.worktype = 'RECEIVE';
      lmscan.iscomplete = 'N';
      lmscan.datetime = new Date(this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS'));
      await this.lmscanRepo().save(lmscan);
    }
    if (truckvo.llIsConsCross) {
      await this.addUpdateConsCross(truckvo.lcPal, truckvo.lcConscode);
    }

    result = truckvo.curOper;
    return result;
  }

  async GetModPallet(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let errMsg = '';
    truckvo.curOper = TruckReceiveState.MARK_PROCESS_GET_MOD;
    if (body.snkPal && body.snkPal.trim().toUpperCase() === 'Y') {
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_MOD_PAL;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    } else if (body.snkPal && body.snkPal.trim().toUpperCase() === 'N') {
      const config = (truckvo.CONFIG as unknown) as Config;
      const glPutDuringRec = config ? config.putAwayDuringReceiving : false;
      if (glPutDuringRec) {
        truckvo.pcPutAway = 'N';
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PUT_AWAY;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      } else {
        return this.processLastPallet(fwho, truckvo, constant);
      }
    } else {
      errMsg = constant.BLAST_MUST_YN.trim();
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT} `,
    );
  }

  async processGetModPallet(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let warnMsg = '';
    let modPID = '';
    if (body.modPID && body.modPID.length > 0) {
      modPID = body.modPID.trim();
    }

    /*** Mask Definition Validation ****/
    let errMsg = '';
    truckvo.curOper = TruckReceiveState.MARK_PROCESS_MOD_PAL;
    const maskResult = new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT} `,
    );

    const maskDefValid = await this.validateMaskDefinitionService.palletMaskDefinition<
      PostResponseTruckReceiveDTO,
      TruckReceiveVO
    >(
      maskResult,
      truckvo.LOADIN.fcustcode,
      modPID,
      MaskingTypeEnum.PALLETID,
      truckvo,
      ModuleNameEnum.TRUCK_RECEIVE,
    );
    if (maskDefValid) {
      return maskDefValid;
    }

    const result = await this.storedProceduresNewService.getMarkmodpids({
      inBatch: truckvo.lcBatch,
      inModpid: modPID,
      inPid: truckvo.lcPal,
      inRectypecheck: 0,
      outMessage: ''.padStart(100, ' '),
    });
    if (result && result.output && result.output.out_message) {
      if (result.output.out_message.toUpperCase().trim() === 'PASS') {
        warnMsg = '';
        const config = (truckvo.CONFIG as unknown) as Config;
        const glPutDuringRec = config ? config.putAwayDuringReceiving : false;
        if (glPutDuringRec) {
          truckvo.pcPutAway = 'N';
          truckvo.curOper = TruckReceiveState.MARK_PROCESS_PUT_AWAY;
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        } else {
          return this.processLastPallet(fwho, truckvo, constant);
        }
      } else {
        warnMsg = result.output.out_message.trim();
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_GET_MOD;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      }
    } else {
      warnMsg = constant.MODPID_NOT_EXIST.trim();
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_GET_MOD;
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg: '',
        infoMsg: '',
        warnMsg,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT} `,
    );
  }

  async processLastPallet(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    const scrnUI = [];

    if (truckvo.plDynamicRail) {
      const [PHY_MST] = await this.manager().query(
        `BEGIN
      SELECT
      id, TRIM(ftrack) ftrack, TRIM(fserial) fserial
            FROM dbo.PHY_MST WHERE fpalletid = '${truckvo.lcPal}'
            order by fpalletid ASC;
      END`,
      );
      if (PHY_MST) {
        await this.RFDynamicSlottingApi(PHY_MST.ftrack, PHY_MST.fserial);
        await this.storedProceduresNewService.getDynamicwarehousepostreceivework(
          {
            inBatch: '',
            inIsrftype: '',
            inSerial: PHY_MST.fserial,
            inTrack: PHY_MST.ftrack,
            outNewloc: '',
          },
        );
      }
    }

    const LOADINresult = await this.manager().query(
      `BEGIN SELECT id, trim(fscanstat) fscanstat FROM dbo.Loadin WHERE fbatch = '${truckvo.lcBatch}' order by fbatch ASC; END`,
    );
    const LOADIN: Loadin = LOADINresult[0];
    if (LOADIN && LOADIN.fscanstat) {
      truckvo.pcMultiRecScanStat = LOADIN.fscanstat;
    }
    const checkXdock = await this.checkCrossDock(fwho, truckvo, constant);
    if (truckvo.plMultiReceiver && truckvo.pcMultiRecScanStat === 'R') {
      truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE_REC;
    } else if (
      truckvo.quickRec &&
      ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv) &&
      !checkXdock.length
    ) {
      return await this.processNavigateToPalletIdScreen(
        fwho,
        truckvo.LOADIN?.fconfirmnm,
        truckvo,
        constant,
      );
    } else {
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_PROD; // In truck receive it will go prod screen which is second screen
      if (
        !truckvo.llQuickrcv &&
        !(
          truckvo.quickRec &&
          ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
        )
      ) {
        truckvo.lcPal = '';
      } else if (
        truckvo.QuickReciverDone &&
        !(
          truckvo.quickRec &&
          ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
        )
      ) {
        truckvo.lcPal = '';
        truckvo.QuickReciverDone = false;
      }

      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.hideUntilEnabled = false;
      scrnUI.push(prodField);
    }
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT} `,
    );
  }

  async processPutAway(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let infoMsg = '';
    let errMsg = '';
    if (body.putAway && body.putAway.trim().toUpperCase() === 'Y') {
      truckvo.putAway = 'Y';
      // DO TBLUPD WITH "PHY_MST"
      // DO DirectedPutaway WITH.T., .F.
      infoMsg = 'DirectedPutaway';
      await this.processLastPallet(fwho, truckvo, constant);
    } else if (body.putAway && body.putAway.trim().toUpperCase() === 'N') {
      return this.processLastPallet(fwho, truckvo, constant);
    } else {
      errMsg = constant.BLAST_MUST_YN.trim();
    }

    const scrnUI = [];
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD) {
      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.hideUntilEnabled = false;
      scrnUI.push(prodField);
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg,
        curOper: truckvo.curOper,
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT} `,
    );
  }

  async USEDF6COPY(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    truckvo.lcProd = truckvo.lcOldProd;
    truckvo.lcDte = truckvo.lcOldDte;
    truckvo.lcIsBlast = truckvo.lcOldIsBlast;
    truckvo.lcIsHPP = truckvo.lcOldisHPP;
    truckvo.lcLot = truckvo.lcOldLot;
    truckvo.lcClot = truckvo.lcOldClot;
    truckvo.lcEstb = truckvo.lcOldEstb;
    truckvo.lcSlaughDte = truckvo.lcOldSlaughDte;
    truckvo.lcRef = truckvo.lcOldRef;
    truckvo.lcTemp = truckvo.lcOldTemp;
    truckvo.lcDteTyp = truckvo.lcOldDteTyp;
    truckvo.llIscatch = truckvo.llOldCatch;
    truckvo.lcAcwt = truckvo.lcOldAcwt;
    truckvo.lnBlasthrs = truckvo.lnOldBlasthrs;
    truckvo.lnIntie = truckvo.lnOldTie;
    truckvo.lnHigh = truckvo.lnOldHigh;
    truckvo.lcBbdte = truckvo.lcOldbbdte;

    const [PHY_MST] = await this.manager().query(
      `BEGIN
          SELECT id, TRIM(fpalletid) fpalletid, fisblast, fblasthrs, fishpp,
        TRIM(ftrack) ftrack, TRIM(fserial) fserial, TRIM(fcustcode) fcustcode,
          TRIM(fhold) fhold, TRIM(fcustcode) fcustcode
          FROM dbo.PHY_MST WHERE fpalletid = '${truckvo.lcPal}'
          order by fpalletid ASC;
      END`,
    );

    if (PHY_MST) {
      PHY_MST.fisblast = truckvo.lcIsBlast === 'N';
      PHY_MST.fblasthrs = truckvo.lcIsBlast !== 'N' ? 0 : truckvo.lnBlasthrs; // TRM 03 / 03 / 2003 Ticket 4364
      PHY_MST.fishpp = truckvo.lcIsHPP !== 'N';

      let plUseStackHold = false;
      const [result] = await this.facilityService
        .getConnection()
        .createEntityManager()
        .query(
          `SELECT plUseStackHold = CASE WHEN EXISTS(SELECT 1 FROM DBO.CUSTSET WHERE FCUSTCODE = '${PHY_MST.fcustcode}' AND USESTACKHOLD = 1) THEN 1 ELSE 0 END; `,
        );
      if (result && result.plUseStackHold && result.plUseStackHold === true) {
        plUseStackHold = true;
      }

      PHY_MST.fishpp = truckvo.lcIsHPP !== 'N';
      if (plUseStackHold && truckvo.lcIsHPP !== 'N') {
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
        PHY_MST.fhold = truckvo.lcIsHPP === 'N' ? 'NONE' : 'HPP';
      }
      await this.phymstRepo().save(PHY_MST);
    }

    truckvo.curOper = TruckReceiveState.MARK_PROCESS_DATE;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg: '',
        curOper: truckvo.curOper,
      }),
      getOutputFields(truckvo.lcDteTyp !== 'J' ? 'codeDate' : 'julinDate'),
      '',
      '',
      `${constant.F5_EXIT} `,
    );
  }

  async QUICKOUT(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
    warnMsg1: string,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    const startTime = moment();
    this.logger.debug(
      {
        fwho,
        startTime: `${moment().format('HH:mm:ss-SSS')} `,
        lcPal: truckvo.lcPal,
        foutbatch: truckvo.LOADIN.foutbatch,
      },
      `QUICKOUT > BEGIN with ${truckvo.curOper} `,
    );
    const errMsg = '';
    let warnMsg = warnMsg1.trim() ? warnMsg1 : '';
    const result = ['D', 'B', 'W'].includes(
      truckvo.lcPal.toUpperCase().charAt(0),
    );
    const fdatestamp = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
    const ftimestamp = this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');
    if (!result) {
      const LOADOUTQUERY = `SELECT CONVERT(varchar, fbdate, 23) as LFBDATE, * FROM LOADOUT WHERE FBATCH = @0 ORDER BY FBATCH ASC; `;
      const LOADOUT = await this.manager().query(
        `BEGIN ${LOADOUTQUERY} END; `,
        [truckvo.LOADIN.foutbatch],
      );
      if (LOADOUT && LOADOUT.length > 0) {
        this.logger.debug({ LOADOUT }, 'QUICKOUT > LOADOUT length > 0');
        const PHY_MSTQUERY = `SELECT TOP 1 * FROM PHY_MST WHERE FPALLETID = @0 ORDER BY FPALLETID ASC; `;
        const PHY_MST = await this.manager().query(
          `BEGIN ${PHY_MSTQUERY} END; `,
          [truckvo.lcPal],
        );
        if (PHY_MST && PHY_MST.length > 0) {
          this.logger.debug({ PHY_MST }, 'QUICKOUT > PHY_MST length > 0');
          const INV_MSTQUERY = `SELECT CONVERT(varchar, FLASTBILL, 23) as IFLASTBILL,  * FROM INV_MST WHERE BatchSeq = @0 ORDER BY FBATCH + FSEQUENCE DESC; `;
          const INV_MST = await this.manager().query(
            `BEGIN ${INV_MSTQUERY} END; `,
            [PHY_MST[0].FTRACK],
          );

          if (INV_MST && INV_MST.length > 0) {
            this.logger.debug({ INV_MST }, 'QUICKOUT > INV_MST length > 0');
            if (INV_MST[0].FSEQUENCE === '001') {
              // const fsalesord = INV_MST[0].FLOT;
              const updateLOADOUT = `UPDATE LOADOUT SET FSALESORD = @0 WHERE id = @1; `;
              await this.manager().query(`BEGIN ${updateLOADOUT} END; `, [
                INV_MST[0].FLOT.slice(0, 15),
                LOADOUT[0].ID,
              ]);
            }
            const CODE2Query = `SELECT * FROM CODE2 WHERE FCUSTCODE = @0
                                AND FPRODGROUP = @1  AND FPRODUCT = @2 AND
      FOWNER = @3 AND FSUPLRPROD = @4
                                ORDER BY FCUSTCODE + FPRODGROUP + FPRODUCT + FOWNER + FSUPLRPROD ASC; `;
            const CODE2 = await this.manager().query(
              `BEGIN ${CODE2Query} END; `,
              [
                INV_MST[0].FCUSTCODE,
                INV_MST[0].FPRODGROUP,
                INV_MST[0].FPRODUCT,
                INV_MST[0].FOWNER,
                INV_MST[0].FSUPLRPROD,
              ],
            );
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
              let INVTRNQUERY = `SELECT * FROM INV_TRN WHERE FBATCH = @0 AND FTRACK = @1
                                  ORDER BY FBATCH + FTRACK  ASC; `;
              let INV_TRN = await this.manager().query(
                `BEGIN ${INVTRNQUERY} END; `,
                [truckvo.LOADIN.foutbatch, PHY_MST[0].FTRACK],
              );
              this.logger.debug({ INV_TRN }, 'QUICKOUT > INV_TRN');
              let rfcQuickseq = '';
              if (INV_TRN.length === 0) {
                INVTRNQUERY = `SELECT * FROM INV_TRN WHERE FBATCH = @0 ORDER BY FBATCH + FSEQUENCE  DESC; `;
                INV_TRN = await this.manager().query(
                  `BEGIN ${INVTRNQUERY} END; `,
                  [truckvo.LOADIN.foutbatch],
                );
                this.logger.debug(
                  { INV_TRN },
                  'QUICKOUT > INV_TRN length === 0',
                );
                rfcQuickseq =
                  INV_TRN && INV_TRN.length > 0 && INV_TRN[0].FSEQUENCE
                    ? `${`000${Number(INV_TRN[0].FSEQUENCE) + 1}`
                      .toString() // ARCHIT fixed bug for quick-receive LCRF-8876
                      .trim()
                      .slice(-3)} `
                    : '001';
                const InvTrnQuery = `BEGIN INSERT into INV_TRN(
        fbatch, fsequence, fcustcode, fbdate, ftrack, ftrack2, frectype, fprodgroup, fproduct,
        fowner, fsuplrprod, fcomittype, fqty, flastbill, fwho, fdatestamp, ftimestamp) VALUES(
          '${LOADOUT[0].FBATCH}', '${rfcQuickseq}', '${LOADOUT[0].FCUSTCODE}', '${LOADOUT[0].LFBDATE}', '${INV_MST[0].FBATCH}${INV_MST[0].FSEQUENCE}',
          '${INV_MST[0].FTRACK2}', 'C', '${INV_MST[0].FPRODGROUP}', '${INV_MST[0].FPRODUCT}', '${INV_MST[0].FOWNER}', '${INV_MST[0].FSUPLRPROD}',
          'G', '${PHY_MST[0].FQTY}', '${INV_MST[0].IFLASTBILL}', '${fwho}', '${fdatestamp}', '${ftimestamp}'); END; `;
                await this.manager().query(InvTrnQuery);
                INV_TRN = []; // ARCHIT fixed bug for quick-receive LCRF-8876
              }
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
                  : `${INV_MST[0].FBATCH}${INV_MST[0].FSEQUENCE} `;
              const PHYTRNQUERY = `SELECT * FROM PHY_TRN WHERE FBATCH = @0 AND FSEQUENCE = @1 AND FTRACK = @2 AND FSERIAL = @3
                                  ORDER BY FBATCH + FSEQUENCE + FTRACK + FSERIAL  ASC; `; // CHECK
              const PHY_TRN = await this.manager().query(
                `BEGIN ${PHYTRNQUERY} END; `,
                [invTrnFbatch, invTrnSeq, invTrnTrack, PHY_MST[0].FSERIAL],
              );
              if (PHY_TRN && PHY_TRN.length > 0) {
                this.logger.debug({ PHY_TRN }, 'QUICKOUT > PHY_TRN length > 0');
                await this.manager()
                  .query(`BEGIN UPDATE PHY_TRN SET  FQTY = ${PHY_MST[0].FQTY}, FPAL = ${PHY_MST[0].FPAL}, FWHO = '${fwho}',
        fdatestamp = '${fdatestamp}', ftimestamp = '${ftimestamp}' WHERE id = ${PHY_TRN[0].ID}; END; `);
              } else {
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
                const phyTrnInsQuery = `BEGIN INSERT into PHY_TRN(
          fcustcode, fbatch, fsequence, ftrack, fserial, frectype, fqty, fpal, flocation, fpickcode,
          fdelvshelf, fstatus, fwho, fdatestamp, ftimestamp, fscandate, fscantime, fscanwho, fscnoutsta)
      VALUES('${PHYTRN.fcustcode}', '${PHYTRN.fbatch}', '${PHYTRN.fsequence}', '${PHYTRN.ftrack}', '${PHYTRN.fserial}',
        '${PHYTRN.frectype}', '${PHYTRN.fqty}', '${PHYTRN.fpal}', '${PHYTRN.flocation}', '${PHYTRN.fpickcode}',
        '${PHYTRN.fdelvshelf}', '${PHYTRN.fstatus}', '${PHYTRN.fwho}', '${fdatestamp}', '${ftimestamp}',
        '${fdatestamp}', '${ftimestamp}', '${PHYTRN.fscanwho}', '${PHYTRN.fscnoutsta}'); END; `;
                await this.manager().query(phyTrnInsQuery);
              }
              const STAGEQUERY = `SELECT * FROM STAGE WHERE FCUBEDID = @0
                                  ORDER BY FCUBEDID ASC; `; // CHECK STGID
              let STAGE = await this.manager().query(
                `BEGIN ${STAGEQUERY} END; `,
                [PHY_MST[0].FPALLETID],
              );
              const stageFloadDate =
                STAGE && STAGE.length > 0 ? STAGE[0].FLOADDATE : '';
              if (STAGE && STAGE.length > 0) {
                // STAGE.fbatch = LOADOUT[0].FBATCH;
                // STAGE.fmbol = LOADOUT[0].FMBOL;
                this.logger.debug({ STAGE }, 'QUICKOUT > STAGE length > 0');
                const flocation = `DR${truckvo.LOADIN.fdoornum
                  .toString()
                  .slice(0, 3)
                  .trim()
                  .padStart(3, '0')} `;
                await this.manager()
                  .query(`BEGIN UPDATE STAGE SET FBATCH = '${LOADOUT[0].FBATCH}', FMBOL = '${LOADOUT[0].FMBOL}', FLOCATION = '${flocation}',
        FDOOR = '${LOADOUT[0].FDOOR}', FDROPNUM = '${LOADOUT[0].FDROPNUM}', FPRODUCT = '${INV_MST[0].FPRODUCT}', FQTY = '${PHY_MST[0].FQTY}', FSEQUENCE = '${invTrnSeq}',
        FTRACK = '${invTrnTrack}', FSERIAL = '${PHY_MST[0].FSERIAL}', FTODOOR = 'Y' WHERE id = ${STAGE[0].ID}; END; `);
                // await this.stageRepo().save(STAGE);
              } else {
                STAGE = new Stage();
                STAGE.fbatch = LOADOUT[0].FBATCH;
                STAGE.fmbol = LOADOUT[0].FMBOL;
                STAGE.fcubedid = PHY_MST[0].FPALLETID;
                STAGE.flocation = `DR${truckvo.LOADIN.fdoornum
                  .toString()
                  .slice(0, 3)
                  .trim()
                  .padStart(3, '0')} `;
                STAGE.fdoor = LOADOUT[0].FDOOR;
                STAGE.fdropnum = LOADOUT[0].FDROPNUM;
                STAGE.fproduct = INV_MST[0].FPRODUCT;
                STAGE.fqty = PHY_MST[0].FQTY;
                STAGE.fsequence = invTrnSeq;
                STAGE.ftrack = invTrnTrack;
                STAGE.fserial = PHY_MST[0].FSERIAL;
                STAGE.ftodoor = 'Y';
                STAGE.fplandate = fdatestamp;
                const stageQuery = `BEGIN INSERT into STAGE(fbatch, fmbol, fcubedid, flocation,
        fdoor, fdropnum, fproduct, fqty, fsequence, ftrack, fserial, ftodoor, fplandate)
      VALUES('${STAGE.fbatch}', '${STAGE.fmbol}', '${STAGE.fcubedid}', '${STAGE.flocation}',
        '${STAGE.fdoor}', '${STAGE.fdropnum}', '${STAGE.fproduct}', '${STAGE.fqty}', '${STAGE.fsequence}',
        '${STAGE.ftrack}', '${STAGE.fserial}', '${STAGE.ftodoor}', '${STAGE.fplandate}'); END; `;
                await this.manager().query(stageQuery);
              }

              // NEED TO CHECK
              if (CODE2 && CODE2.length > 0 && CODE2[0].FCATCHWGT === 'B') {
                await this.manager()
                  .query(`INSERT INTO PHY_DET(FCUSTCODE, FTRACK, FSERIAL, FRECTYPE, FBATCH, FSEQUENCE, FLOT, FNETWGT, FBOXSEQ, FWHO, FDATESTAMP, FTIMESTAMP, FTEMPPOST, FCODEDTE, FFULLLABEL)
                      SELECT FCUSTCODE, FTRACK, FSERIAL, 'C', '${LOADOUT[0].FBATCH}', '${invTrnSeq}', FLOT, FNETWGT, FBOXSEQ, '${fwho}', '${fdatestamp}', '${ftimestamp}', FTEMPPOST, FCODEDTE, FFULLLABEL
                      FROM dbo.PHY_DET WHERE FTRACK = '${PHY_MST[0].FTRACK}' AND FSERIAL = '${PHY_MST[0].FSERIAL}'
                      AND FBATCH = '${truckvo.LOADIN.fbatch}';
                      IF EXISTS(SELECT 1 FROM PHY_TRN WHERE FBATCH = '${truckvo.LOADIN.fbatch}'
                      AND FTRACK = '${PHY_MST[0].FTRACK}' AND FSERIAL = '${PHY_MST[0].FSERIAL}' AND FSINGLEWGT = 1)
                      BEGIN UPDATE PHY_TRN SET FSINGLEWGT = 1 WHERE FBATCH = '${LOADOUT[0].FBATCH}' AND FSEQUENCE = '${invTrnSeq}'
                      AND FTRACK = '${PHY_MST[0].FTRACK}' AND FSERIAL = '${PHY_MST[0].FSERIAL}' END `);
              }
              if (truckvo.lnFulPalChg !== 0) {
                const DOWNSTACKQUERY = `SELECT * FROM DOWNSTACK WHERE FBATCH = @0 AND FSEQUENCE = @1 AND FTRACK = @2 AND FSERIAL = @3
                                  ORDER BY FBATCH + FSEQUENCE + FTRACK + FSERIAL ASC; `;
                let DOWNSTACK = await this.manager().query(
                  `BEGIN ${DOWNSTACKQUERY} END; `,
                  [invTrnFbatch, invTrnSeq, invTrnTrack, PHY_MST[0].FSERIAL],
                );
                this.logger.debug(
                  { lnFulPalChg: truckvo.lnFulPalChg, DOWNSTACK },
                  'QUICKOUT > truckvo.lnFulPalChg, DOWNSTACK',
                );
                if (!DOWNSTACK) {
                  DOWNSTACK = new Downstack();
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
                    truckvo.lnFulPalChg.toFixed(2),
                  );
                  DOWNSTACK.forigamt = Number.parseFloat(
                    truckvo.lnFulPalChg.toFixed(2),
                  );
                  DOWNSTACK.fgl = truckvo.lcFulPalgl;
                  DOWNSTACK.fbilltype = 'FC';
                  DOWNSTACK.frate = truckvo.lnFulPalChg;
                  DOWNSTACK.fwho = fwho;
                  DOWNSTACK.fdatestamp = fdatestamp;
                  await this.manager()
                    .query(`BEGIN INSERT into DOWNSTACK(fcustcode, flot, fprodgroup, fproduct, fowner,
          fsuplrprod, forigcust, fqty, fbatch, fsequence, ftrack, fserial, fpalletid, fdebit, forigamt, fgl, fbilltype, frate, fwho, fdatestamp)
      VALUES('${DOWNSTACK.fcustcode}', '${DOWNSTACK.flot}', '${DOWNSTACK.fprodgroup}', '${DOWNSTACK.fproduct}', '${DOWNSTACK.fowner}', '${DOWNSTACK.fsuplrprod}', '${DOWNSTACK.forigcust}', '${DOWNSTACK.fqty}', '${DOWNSTACK.fbatch}', '${DOWNSTACK.fsequence}', '${DOWNSTACK.ftrack}', '${DOWNSTACK.fserial}', '${DOWNSTACK.fpalletid}', '${DOWNSTACK.fdebit}', '${DOWNSTACK.forigamt}', '${DOWNSTACK.fgl}',
        '${DOWNSTACK.fbilltype}', '${DOWNSTACK.frate}', '${DOWNSTACK.fwho}', '${DOWNSTACK.fdatestamp}'); END; `);
                }
              }
              if (
                truckvo.llIntruckToTruck &&
                !stageFloadDate &&
                !truckvo.llInTruckStage
                // In Q Flow loading is coming here after send pallet info.
              ) {
                // TODO - DO Loading.prg WITH lcInMachineID,lc_pal,.T.
                const phyMstLData = await this.manager().query(
                  `BEGIN select id, fhold, ftrack, fserial, fqty, fmergeid, fpalletid, fstatus, fcustcode, flocation from PHY_MST where FPALLETID = '${truckvo.lcPal}' END; `,
                );

                const lcvo = new LoadingVO();
                if (phyMstLData && phyMstLData.length > 0) {
                  lcvo.PHYMST = phyMstLData[0];
                }
                // lcvo.PHYMST = phyMstL;
                lcvo.pcMachineID = truckvo.lcInMachineID
                  ? truckvo.lcInMachineID
                  : '';
                lcvo.lcPal = truckvo.lcPal;
                lcvo.tcTruck2Truck = true;
                lcvo.curOper = 'MARK_PROCESS_PALLET';
                lcvo.originator = 'TRUCKRECEIVE-LOADING';
                truckvo.QuickReciverDone = true;
                this.logger.debug(
                  {
                    'lcvo.lcPal': lcvo.lcPal,
                    'lcvo.curOper': lcvo.curOper,
                    // 'lcvo.originator': lcvo.originator,// TODO
                    QuickReciverDone: truckvo.QuickReciverDone,
                  },
                  'QUICKOUT > loading flow',
                );
                await this.cacheService.set2Obj(
                  fwho,
                  TRUCKRECEIVE,
                  truckvo,
                  OBLOADING,
                  lcvo,
                );
                return new ResponseKeysDTO(
                  plainToClass(PostResponseTruckReceiveDTO, {
                    errMsg: '',
                    infoMsg: 'LOADING',
                    curOper: truckvo.curOper,
                    warnMsg,
                  }),
                  getOutFieldState(truckvo.curOper),
                );
              }
            } else {
              warnMsg = `${warnMsg} \n${constant.PALLET_ONHOLD} `;
              this.logger.debug({ warnMsg }, 'QUICKOUT > warnMsg');
            }
            // }
          }
        }
      }
    } else {
      warnMsg = constant.DAMAGED_PALLET.trim();
      this.logger.debug({ warnMsg }, 'QUICKOUT > warnMsg');
    }
    // The code which was modified on processlastpallet is added here
    // truckvo.lc_pal = '';
    truckvo.QuickReciverDone = true;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    this.logger.debug(
      {
        service: TruckReceiveService.name,
        curOper: truckvo.curOper,
        fwho,
      },
      `Truck - receive-- > QUICKOUT | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')} `,
    );

    let scrnUI = [];
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD) {
      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.hideUntilEnabled = false;
      scrnUI.push(prodField);
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        warnMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT} `,
    );
  }

  async OUTCLOSE(truckvo: TruckReceiveVO, outBatch: any): Promise<void> {
    const startTime = moment();
    this.logger.debug(
      {
        startTime: `${moment().format('HH:mm:ss-SSS')} `,
        lcBatch: truckvo.lcBatch,
        // lcOutbatch: truckvo.lcOutbatch,
        lcOutbatch: outBatch,
      },
      `OUTCLOSE > BEGIN with ${truckvo.curOper} `,
    );
    const LOADOUTQUERY = `SELECT FBATCH, ID FROM LOADOUT WHERE FBATCH = @0 ORDER BY FBATCH ASC; `;
    const LOADOUT = await this.manager().query(`BEGIN ${LOADOUTQUERY} END; `, [
      // truckvo.lcOutbatch,
      outBatch,
    ]);

    if (LOADOUT && LOADOUT.length > 0) {
      this.logger.debug({ LOADOUT }, 'OUTCLOSE > LOADOUT length > 0');
      // const INV_TRNQUERY = `SELECT * FROM INV_TRN WHERE FBATCH = @0 ORDER BY FBATCH + FSEQUENCE ASC; `;
      // const INVTRN = await this.manager().query(`BEGIN ${ INV_TRNQUERY } END; `, [
      //   truckvo.lcOutbatch,
      // ]);
      const INV_TRNQUERY = `SELECT FBATCH, FSEQUENCE, FTRACK, FGROSSWGT, FQTY, ID FROM INV_TRN WHERE FBATCH = @0 ORDER BY FBATCH + FSEQUENCE ASC; `;
      const INVTRN = await this.manager()
        .query(`BEGIN ${INV_TRNQUERY} END; `, [
          // truckvo.lcOutbatch,
          // truckvo.lcBatch
          outBatch,
        ])
        .catch(err => {
          this.logger.error(
            // { fbatch: truckvo.lcOutbatch },
            { fbatch: outBatch },
            'Error in INVTRN FETCH Query',
            'TRUCKRECEIVE > PROCESS_OUTCLOSE',
          );
          throw err;
        });
      // const PHY_MST_ARR = await this.manager()
      //   .query(`BEGIN SELECT id, TRIM(ftrack) ftrack, TRIM(fserial) fserial, fqty, fishpp, fpal, FO_PAL as foPal, FO_QTY as foQty,
      //   TRIM(fcustcode) fcustcode, TRIM(fcustpalid) fcustpalid, TRIM(fpalletid) fpalletid, TRIM(fhold) fhold, fishpp
      //   FROM PHY_MST WHERE FTRACK LIKE '${truckvo.lcBatch}%' ORDER BY FTRACK+FSERIAL ASC; END`);
      const PhytrnQUERY = `SELECT * FROM PHY_TRN WHERE FBATCH = @0 ORDER BY FBATCH+FSEQUENCE+FTRACK+FSERIAL ASC;`;
      const PHY_TRN_ARR = await this.manager().query(
        `BEGIN ${PhytrnQUERY} END;`,
        // [truckvo.lcOutbatch],
        [outBatch],
      );
      // const INV_MST = await this.manager().query(
      //   `BEGIN SELECT FBATCH,FSEQUENCE FROM INV_MST WHERE FBATCH = '${truckvo.lcBatch}' ORDER BY FBATCH+FSEQUENCE ASC; END`,
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
        // if (INV_TRN && INV_TRN.FBATCH === truckvo.lcOutbatch) {
        if (INV_TRN && INV_TRN.FBATCH === outBatch) {
          // const PhyTrnQuery = `SELECT * FROM PHY_TRN WHERE FBATCH = @0
          //             AND FSEQUENCE = @1 AND FTRACK = @2
          //             ORDER BY FBATCH+FSEQUENCE+FTRACK+FSERIAL ASC;`;
          // const  PHYTRN =  await this.manager().query(`BEGIN ${PhyTrnQuery} END;`, [INV_TRN.FBATCH, INV_TRN.FSEQUENCE, INV_TRN.FTRACK ]);
          const PHY_TRN: any[] = [];
          // eslint-disable-next-line array-callback-return
          PHY_TRN_ARR.find((item: any) => {
            if (
              item.FBATCH === INV_TRN.FBATCH?.trim() &&
              item.FSEQUENCE === INV_TRN.FSEQUENCE?.trim() &&
              item.FTRACK === INV_TRN.FTRACK?.trim()
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
              const PHY_MST_ARR = await this.manager()
                .query(`BEGIN SELECT id, TRIM(ftrack) ftrack, TRIM(fserial) fserial, fqty, fishpp, fpal, FO_PAL as foPal, FO_QTY as foQty,
              TRIM(fcustcode) fcustcode, TRIM(fcustpalid) fcustpalid, TRIM(fpalletid) fpalletid, TRIM(fhold) fhold, fishpp
              FROM PHY_MST WHERE FTRACK LIKE '${PHYTRN.FTRACK}%' AND FSERIAL = '${PHYTRN.FSERIAL}' ORDER BY FTRACK+FSERIAL ASC; END`);
              const PHY_MST = PHY_MST_ARR.find(
                (item: any) =>
                  item.ftrack === PHYTRN.FTRACK?.trim() &&
                  item.fserial === PHYTRN.FSERIAL?.trim(),
              );
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
            const updateMstTrn = `UPDATE INV_TRN SET FPAL = ${lnpals}, FQTY = ${lnqty} WHERE ID = '${INV_TRN.ID}';`;
            await this.manager().query(`BEGIN ${updateMstTrn}; END;`);
            InvTrnFQTY = lnqty;
            const INV_MST = await this.manager().query(
              `BEGIN SELECT * FROM INV_MST WHERE batchseq = '${INV_TRN.FTRACK}' ORDER BY FBATCH+FSEQUENCE ASC; END`,
            );
            const INVMST = INV_MST.find(
              (item: any) => item.BatchSeq === INV_TRN.FTRACK,
            );
            this.logger.debug(
              { INVMST },
              'OUTCLOSE > INVMST (item.BatchSeq === INV_TRN.FTRACK)',
            );
            if (INVMST) {
              // Calculate Weights!
              const CODE2QUERY = `SELECT * FROM CODE2 WHERE FCUSTCODE = @0
                                  AND FPRODGROUP = @1 AND FPRODUCT = @2
                                  AND FOWNER = @3 AND FSUPLRPROD = @4
                                  ORDER BY FCUSTCODE+FPRODGROUP+FPRODUCT+FOWNER+FSUPLRPROD  ASC;`;
              const CODE2 = await this.manager().query(
                `BEGIN ${CODE2QUERY} END;`,
                [
                  INVMST.FCUSTCODE,
                  INVMST.FPRODGROUP,
                  INVMST.FPRODUCT,
                  INVMST.FOWNER,
                  INVMST.FSUPLRPROD,
                ],
              );
              this.logger.debug({ CODE2 }, 'OUTCLOSE > CODE2');
              let lciscwgt = 'N';
              if (
                CODE2 &&
                CODE2.length > 0 &&
                CODE2[0].FCATCHWGT &&
                (CODE2[0].FCATCHWGT === 'I' || CODE2[0].FCATCHWGT === 'B')
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
                const PhyDetQuery = `SELECT FBATCH,FSEQUENCE FROM PHY_DET WHERE FBATCH = @0
                                  AND FSEQUENCE = @1
                                  ORDER BY FBATCH + FSEQUENCE ASC;`;
                const PHY_DET = await this.manager().query(
                  `BEGIN ${PhyDetQuery} END;`,
                  [INV_TRN.FBATCH, INV_TRN.FSEQUENCE],
                );
                this.logger.debug(
                  {
                    PHY_DET,
                  },
                  'OUTCLOSE > PHY_DET',
                );
                if (PHY_DET && PHY_DET.length > 0) {
                  // let sum = 0
                  const phyDetLnWgt = await this.manager().query(
                    `select sum(fnetwgt) as lnWgt2 from PHY_DET where fbatch = '${INV_TRN.FBATCH}' and fsequence = '${INV_TRN.FSEQUENCE}'`,
                  );
                  lnWgt2 = phyDetLnWgt[0].lnWgt2;
                  lnWgt1 = lnWgt2 + CODE2[0].FTARE * lnqty;
                } else {
                  lnWgt1 = CODE2[0].FGROSSWGT * lnqty;
                  lnWgt2 = CODE2[0].FNETWGT * lnqty;
                }
              } else {
                lnWgt1 = CODE2[0].FGROSSWGT * lnqty;
                lnWgt2 = CODE2[0].FNETWGT * lnqty;
              }
              let updateInvMstInvTrn = '';
              updateInvMstInvTrn = `UPDATE INV_TRN SET FGROSSWGT = '${lnWgt1}', FNETWGT = '${lnWgt2}' WHERE  ID = '${INV_TRN.ID}';`;
              updateInvMstInvTrn = `${updateInvMstInvTrn} UPDATE INV_MST SET FC_GROSWGT = '${lnWgt1}', FC_NETWGT = '${lnWgt2}', FC_QTY = ${lnqty},   FC_PAL = ${lnpals} WHERE id =  ${INVMST.ID} ;`;
              InvTrnGrossWgt = lnWgt1;
              await this.manager().query(`BEGIN ${updateInvMstInvTrn}; END;`);
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
        }
      }
      if (delInvTrnIds?.length > 0) {
        this.logger.debug({ delInvTrnIds }, 'OUTCLOSE > Deleting from INV_TRN');
        const deleteInvTrn = `DELETE FROM INV_TRN WHERE id IN (${delInvTrnIds}); `;
        await this.manager().query(`BEGIN ${deleteInvTrn}; END;`);
      }

      try {
        const fscanentime = this.facilityService.getFacilityCurrentDateTimeFormatted('HH:mm');
        const fscanendte = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');

        const loadout = `UPDATE LOADOUT SET FSCANSTAT = 'C', FCHECKQTY = ${lnQcount}, FCHECKGROS = ${lnWcount}, FSCANENTME = '${fscanentime}', FSCANENDTE = '${fscanendte}'  WHERE ID = '${LOADOUT[0].ID}';`;
        await this.manager().query(`BEGIN ${loadout}; END;`);
        const LOADIN = (truckvo.LOADIN as unknown) as Loadin;
        if (LOADIN) {
          const { ffinishtme, ffinishdte } = LOADIN;
          this.logger.debug(
            { ffinishdte, ffinishtme },
            'OUTCLOSE > ffinishtme,ffinishdte',
          );
          const loadinUpdate = `UPDATE LOADIN SET ffinishdte = '${ffinishdte}', ffinishtme = '${ffinishtme}'  WHERE ID = '${LOADOUT[0].ID}';`;
          await this.manager().query(`BEGIN ${loadinUpdate}; END;`);
        }
      } catch (error) {
        this.logger.error(
          { error, message: 'LOADIN error OUTCLOSE -->' },
          'Error in OUTCLOSE',
          TruckReceiveService.name,
        );
      }
    }
    this.logger.debug(
      {
        service: TruckReceiveService.name,
        curOper: truckvo.curOper,
      },
      `Truck-receive --> OUTCLOSE | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')}`,
    );
  }

  async SEEIFXDOCK(truckvo: TruckReceiveVO): Promise<void> {
    if (
      truckvo.lcBatch &&
      truckvo.lcBatch.length > 0 &&
      truckvo.LOADIN &&
      truckvo.LOADIN?.fhasxdock !== true
    ) {
      const HASXDOCKresult = await this.manager().query(
        `BEGIN SELECT id FROM dbo.INV_MST WHERE fcanxdock = 1 and fproduct = '${truckvo.lcProd}' and fcustcode = '${truckvo.lcCustCode}' order by fbatch ASC ; END`,
      );
      const HASXDOCK: InvMst = HASXDOCKresult[0];
      if (HASXDOCK) {
        const LOADINresult = await this.manager().query(
          `BEGIN
            SELECT id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate, floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse, ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted, ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi, fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, TRIM(fscanwho) as fscanwho, fscanstdte, fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort, fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment, fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop, fschcoment, fsignintme, fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust, fgroupcode, fcpc, fconsignor, foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched, fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid, ftmsresend, cancelled
            FROM dbo.Loadin WHERE fbatch = '${truckvo.lcBatch.padStart(
            7,
            '0',
          )}' order by fbatch ASC ;
          END`,
        );
        const LOADIN: Loadin = LOADINresult[0];
        if (LOADIN) {
          LOADIN.fhasxdock = true;
          await this.manager().query(
            `BEGIN UPDATE Loadin set fhasxdock = 1 WHERE fbatch = '${truckvo.lcBatch.padStart(
              7,
              '0',
            )}'; END`,
          );
          truckvo.LOADIN = LOADIN;
        }
      }
    }
  }

  async WRITEINVCONTROL(
    fwho: string,
    truckVo: TruckReceiveVO,
    fproblem: string,
    fhowfixed: string,
    fresolved: boolean,
  ): Promise<void> {
    const truckvo = truckVo;
    const date = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS');

    const fwhen: string | null = fresolved ? `'${date}'` : null;
    await this.facilityService.getConnection().createEntityManager()
      .query(`BEGIN INSERT into INVCONTROL (
      foperid,fdatestamp,fworktype,fbatch,fpalletid, fproblem,fhowfixed, fcustcode, fwho, fwhen, fresolved) VALUES (
    '${fwho}', '${date}', 'RFDATECHEC', '${truckvo.lcBatch}', '${truckvo.lcPal
        }', '${fproblem}', '${fhowfixed}', '${truckvo.lcCustCode}',
    '${fresolved ? fwho : ''}', ${fwhen}, ${fresolved ? 1 : 0}); END;`);
  }

  async validConsignee(tcConsignee: string): Promise<boolean> {
    let result: boolean = false;
    const CONSIGNEEres = await this.manager().query(
      `BEGIN SELECT TRIM(fcustcode) fcustcode from CONSIGNEE where fcustcode = '${tcConsignee}' order by fcustcode ASC ; END`,
    );
    const CONSIGNEE = CONSIGNEEres[0];
    if (CONSIGNEE && CONSIGNEE.fcustcode.length > 0) {
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
        TruckReceiveService.name,
      );
    }
    return lcReturn;
  }

  async getLotPatternConfig(truckVo: TruckReceiveVO, CODE2: Code2) {
    const truckvo = truckVo;
    truckvo.lcLotPattern = '';
    truckvo.lnLotPatternStart = 0;

    /* const queryBuilder = this.codelkupRepo()
      .createQueryBuilder('codelkup')
      .select('*')
      .where('codelkup.flist=:cd', { cd: 'cd' });
    queryBuilder.andWhere(`codelkup.fcustcode Like '${CODE2.fcustcode}' or fcustcode='' `)
    const CODELKUP = await queryBuilder.getRawOne(); */
    const CODELKUPresult = await this.manager().query(
      `BEGIN SELECT id, flist, flong, fshort, fcustcode, fcustlong FROM dbo.CODELKUP WHERE FLIST='CD' AND (FCUSTCODE='${CODE2.fcustcode}' OR ISNULL(FCUSTCODE,'')='') order by FLIST+FCUSTCODE+FSHORT ASC ; END;`,
    );
    const CODELKUP: Codelkup = CODELKUPresult[0];
    if (CODELKUP) {
      if (
        `CD${CODE2.fcustcode}${CODE2.flotpatid}` ===
        `${CODELKUP.flist}${CODELKUP.fcustcode}${CODELKUP.fshort}`
      ) {
        truckvo.lcLotPattern =
          CODELKUP.flong && CODELKUP.flong.length > 0
            ? CODELKUP.flong.trim()
            : '';
        truckvo.lnLotPatternStart =
          Number.isNaN(CODELKUP.fcustlong) && Number(CODELKUP.fcustlong) > 0
            ? Number(CODELKUP.fcustlong)
            : 1;
      } else if (
        `CD${'          '}${CODE2.flotpatid}` ===
        `${CODELKUP.flist}${CODELKUP.fcustcode}${CODELKUP.fshort}`
      ) {
        truckvo.lcLotPattern =
          CODELKUP.flong && CODELKUP.flong.length > 0
            ? CODELKUP.flong.trim()
            : '';
        truckvo.lnLotPatternStart =
          Number.isNaN(CODELKUP.fcustlong) && Number(CODELKUP.fcustlong) > 0
            ? Number(CODELKUP.fcustlong)
            : 1;
      }
    }

    this.logger.debug(
      {
        lcLotPattern: truckvo.lcLotPattern,
        lnLotPatternStart: truckvo.lnLotPatternStart,
      },
      'TRUCKRECEIVE >> getLotPatternConfig >> lcLotPattern,lnLotPatternStart',
    );
  }

  LotPatternDateConverter(
    truckVo: TruckReceiveVO,
    tcLotData: string,
    pcLotPattern: string,
    tnLotPatternStart: number,
    tcDateType: string,
  ): string {
    const truckvo = truckVo;
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
        lcReturn = truckvo.lcDteTyp === 'J' ? this.RFJTOD(lcReturn) : lcReturn;
      }
      this.logger.debug(
        'Truck-receive-->',
        `LotPatternDateConverter --> ${tcLotPattern}, ${tnLotPatternStart}, ${tcDateType}`,
      );
      return lcReturn;
    } catch (error) {
      this.logger.error(
        { error, message: 'LotPatternDateConverter -->' },
        'Error in LotPatternDateConverter',
        TruckReceiveService.name,
      );
    }
    return lcReturn;
  }

  async CalcPalletsFromProd(
    fwho: string,
    truckVo: TruckReceiveVO,
    pc_batch: string,
    pc_product: string,
  ): Promise<void> {
    const truckvo = truckVo;
    const query = await this.facilityService
      .getConnection()
      .createEntityManager()
      .query(
        `Select ?@bl_exists = CAST(Case When Exists (Select 1 From DYNAMICRAIL Where FBATCH = ${pc_batch} and FPRODUCT =${pc_product}) Then 1 else 0 End as bit);`,
      );
    if (query && query?.length === 0) {
      const CODE2 = (truckvo.CODE2 as unknown) as Code2;
      await this.storedProceduresNewService.getInsertdynamicrail({
        inFbatch: truckvo.lcBatch,
        inFcustcode: CODE2.fcustcode,
        inFhigh: CODE2.fhigh,
        inFowner: CODE2.fowner,
        inFprodgroup: '',
        inFproduct: CODE2.fprodgroup,
        inFqty: truckvo.lcQty,
        inFsuplrprod: CODE2.fsuplrprod,
        inFtie: CODE2.ftie,
        inFwho: fwho,
      });
    }
  }

  async SCANDATE(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    if (body?.rfreq) {
      truckvo.RFREQ = body.rfreq;
      const RFREQ = body.rfreq;
      truckvo.lcKeyLot = RFREQ?.fkeylot?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyEstb = RFREQ?.fltestbnum?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyRef = RFREQ?.fkeyref?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyTmp = RFREQ?.fkeytemp?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.llUse128Barcode = RFREQ.fuse128Bar;
      truckvo.lnBarcodeScanLength = RFREQ.fscanlngth;
      truckvo.ywwdcool = RFREQ.fyywwdcool ? RFREQ.fyywwdcool : false;
      truckvo.llASNpal = RFREQ.fedipal ? RFREQ.fedipal : false;
      truckvo.llASNpalNoQty = RFREQ.edipalnoqty ? RFREQ.edipalnoqty : false;
      truckvo.lnCustomerPIDLength = RFREQ.CustomerPIDLength;
      truckvo.plAutoFillConsignee = RFREQ.AutoFillConsignee;
    }
    let errMsg = '';
    let warnMsg = '';
    let lcDte = '';
    let data;
    const scrnUI = [];

    const timeZoneIANA = this.facilityService.getWareHouseSettings().timeZoneIANA;

    // line 1161 - && GET CODE DATE/JULIAN DATE SCANDATE

    let outkey = truckvo.lcDteTyp === 'J' ? 'julinDate' : 'codeDate';
    if (body.cdate && body.cdate.trim().length > 0 && outkey === 'codeDate') {
      lcDte = body.cdate.trim();
    } else if (
      body.jdate &&
      body.jdate.trim().length > 0 &&
      outkey === 'julinDate'
    ) {
      lcDte = body.jdate.trim();
    } else {
      errMsg = constant.DATE_EMPTY.trim();
    }

    truckvo.lcDte = lcDte;
    if (lcDte.length === 5 && truckvo.ywwdcool && truckvo.lcDteTyp !== 'N') {
      lcDte = this.YYWWDConverter(lcDte, truckvo.lcDteTyp !== 'J' ? 'C' : 'J');
    }
    if (truckvo.lcDteTyp === 'N') {
      truckvo.lcDte = moment(truckvo.LOADIN.fbdate, 'YYYY-MM-DD').format(
        'MMDDYYYY',
      );
      truckvo.lcOldDte = truckvo.lcDte;
    } else if (
      truckvo.lcLotPattern.length > 0 &&
      truckvo.lcLot.length === 0 &&
      truckvo.lcDte.length >=
      truckvo.lcLotPattern.length + (truckvo.lnLotPatternStart - 1)
    ) {
      lcDte = this.LotPatternDateConverter(
        truckvo,
        truckvo.lcDte,
        truckvo.lcLotPattern,
        truckvo.lnLotPatternStart,
        truckvo.lcDteTyp,
      );
      if (lcDte.length === 8) {
        lcDte = `${lcDte.slice(-4, lcDte.length)}${lcDte.slice(0, 4)}`;
      }
    }

    const CODE2 = (truckvo.CODE2 as unknown) as Code2;
    if (!lcDte && lcDte.length === 0) {
      errMsg = constant.DATE_EMPTY.trim();
    } else if (truckvo.lcDteTyp === 'J') {
      if (lcDte.length === 4) {
        lcDte = `${moment()
          .year()
          .toString()
          .slice(0, 3)}${lcDte}`;
        truckvo.lcDte = lcDte;
      }
      if (truckvo.lcDte.length === 7) {
        const lncyear = Number(lcDte.slice(0, 4));
        const lncday = Number(lcDte.slice(4, 7));
        const y: number = moment().year();
        const d = moment();
        if (
          truckvo.plFutureDate &&
          CODE2.fpickcode.slice(0, 2) === 'PR' &&
          !(lncyear >= y - truckvo.lnYearsback)
        ) {
          errMsg = constant.INVALID_JUL_YR.trim();
          const lccdterr = `Batch ${truckvo.lcBatch
            } \n Pallet ${truckvo.lcPal.padEnd(
              20,
              ' ',
            )} had Julian Date ${lcDte} put in. This date was Incorrect as the year was not ${truckvo.lnYearsback
              .toString()
              .trim()} yr back  of ${d.format('MM/DD/YYYY')}\n  PickCode is ${CODE2.fpickcode
            } Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            truckvo,
            'JULIAN YEAR IS INCORRECT',
            lccdterr,
            true,
          );
        } else if (
          errMsg === '' &&
          !(lncyear >= y - truckvo.lnYearsback && lncyear - 1 <= y)
        ) {
          errMsg = constant.INVALID_JUL_YR.trim();
          const lccdterr = `Batch ${truckvo.lcBatch
            } \n Pallet ${truckvo.lcPal.padEnd(
              20,
              ' ',
            )} had Julian Date ${lcDte} put in. This date was Incorrect as the year was not within ${truckvo.lnYearsback
              .toString()
              .trim()} yr back or 1 yr forward of ${d.format(
                'MM/DD/YYYY',
              )}\n  PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
            }`;
          await this.WRITEINVCONTROL(
            fwho,
            truckvo,
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
          errMsg = constant.INVALID_JUL_DAY.trim();
          const lccdterr = `Batch ${truckvo.lcBatch
            } \n Pallet ${truckvo.lcPal.padEnd(
              20,
              ' ',
            )} had Julian Date ${lcDte} put in.This date was Incorrect as the day was not between 1 and 366. \n PickCode is ${CODE2.fpickcode
            } Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            truckvo,
            'JULIAN DAY IS INCORRECT',
            lccdterr,
            true,
          );
        }
        const ldPdate = moment(this.RFJTODate(lcDte));
        const currentDate = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
        const t = ldPdate.diff(currentDate, 'days');
        const a1 = truckvo.plFutureDate && CODE2.fpickcode.slice(0, 2) === 'PR';
        const a3 =
          CODE2.fpickcode.slice(0, 2) !== 'SB' && CODE2.fpickcode !== 'FIFO';
        if (errMsg === '' && a3 && !a1) {
          if (
            CODE2.fcustcode === truckvo.LOADIN.fcustcode &&
            truckvo.ffuturedte
          ) {
            const newDate = moment(currentDate, 'YYYY-MM-DD').add(1, 'days');
            if (ldPdate > newDate) {
              errMsg = constant.PROD_TODAY.trim();
              const lccdterr = `Batch ${truckvo.lcBatch
                } \n Pallet ${truckvo.lcPal.padEnd(
                  20,
                  ' ',
                )} had Julian Date ${lcDte} put in. \n The Production date is ${ldPdate.format(
                  'MM/DD/YYYY',
                )}  This date was Incorrect as the production date was > todays date ${d.format(
                  'MM/DD/YYYY',
                )} +1 \n  PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
                }`;
              await this.WRITEINVCONTROL(
                fwho,
                truckvo,
                'JULIAN PRODUCTION > TODAY+1',
                lccdterr,
                true,
              );
            }
          } else if (errMsg === '' && t > 0) {
            errMsg = constant.PROD_TODAY.trim();
            const lccdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} had Julian Date ${lcDte} put in. \n  The Production date is ${ldPdate.format(
                'MM/DD/YYYY',
              )}  This date was Incorrect as the production date was > todays date ${d.format(
                'MM/DD/YYYY',
              )} \n  PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
              }`;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
              'JULIAN PRODUCTION > TODAY',
              lccdterr,
              true,
            );
          }
        }

        if (truckvo.plIBRotationRestriction) {
          const result = await this.manager().query(`
          BEGIN
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

          if (
            result &&
            result.length > 0 &&
            result[0]?.pcNewestCodeDate !== '' &&
            Number(lcDte) < Number(result[0].pcNewestCodeDate)
          ) {
            warnMsg = constant.ROTATION_RESTRICTION.trim();
            const chJulDate = getFields(
              TruckReceiveState.MARK_CHANGE_CODE_DATE,
            );
            chJulDate.label = constant.CHANGE_JUL_DATE;
            chJulDate.avoidable = false;
            scrnUI.push(chJulDate);

            truckvo.curOper = TruckReceiveState.MARK_CHANGE_CODE_DATE;
            const lccdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} had Julian Date ${lcDte} put in. \n  The newest Julian Date received for that product is ${result[0].pcNewestCodeDate
              }
                This date is a problem as it is older than the newest Date for the product Received. \n  PickCode is ${CODE2.fpickcode
              } Shelflife is ${CODE2.fshelflife}`;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
              'INBOUND ROTATION RESTRICTION',
              lccdterr,
              false,
            );
            await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
            return new ResponseKeysDTO(
              plainToClass(PostResponseTruckReceiveDTO, {
                curOper: truckvo.curOper,
                errMsg,
                warnMsg,
                scrnUI,
                data,
              }),
              getOutFieldState(truckvo.curOper),
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
          warnMsg = constant.EXP_DATE.trim();
          const lccdterr = `Batch ${truckvo.lcBatch
            } \n Pallet ${truckvo.lcPal.padEnd(
              20,
              ' ',
            )} had Julian Date ${lcDte} put in. \n The Sell By date is ${lcDte.slice(
              0,
              2,
            )}/${lcDte.slice(2, 4)}/${lcDte.slice(
              4,
            )}  This date is a problem as the Expiration date is < 30 days. \n PickCode is ${CODE2.fpickcode
            } Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            truckvo,
            'JULIAN PRODUCTION < 30',
            lccdterr,
            false,
          );
        }
      } else {
        errMsg = constant.INVALID_JUL_DATE.trim();
        const lccdterr = `Batch ${truckvo.lcBatch
          } \n Pallet ${truckvo.lcPal.padEnd(
            20,
            ' ',
          )} had Julian Date ${lcDte} put in. This date was Incorrect as it was not 7 Characters long.\n PickCode is ${CODE2.fpickcode
          } Shelflife is ${CODE2.fshelflife}`;
        await this.WRITEINVCONTROL(
          fwho,
          truckvo,
          'JULIAN IS NOT 7 CHAR LONG',
          lccdterr,
          true,
        );
      }
    } else {
      truckvo.lcDte = lcDte;
      if (lcDte.length === 6) {
        lcDte = moment(truckvo.lcDte, 'MMDDYY').format('MMDDYYYY');
      }

      // Date coming in will be MMDDYY or MMDDYYYY
      if (truckvo.lcDte.length === 6 || truckvo.lcDte.length === 8) {
        const ldcdate =
          truckvo.lcDte.length === 6
            ? moment(truckvo.lcDte, 'MMDDYY')
            : moment(truckvo.lcDte, 'MMDDYYYY');
        const ldSbdateExp = moment(ldcdate, 'MMDDYYYY');
        let lncyear = ldcdate.year();
        let ldPdate;
        const ldSbdate = ldcdate;
        if (CODE2.fpickcode.slice(0, 2) === 'SB') {
          ldPdate = ldcdate.subtract(CODE2.fshelflife, 'days');
          lncyear = ldPdate.year();
        } else {
          ldPdate = ldcdate;
        }
        if (truckvo.plFutureDate && CODE2.fpickcode.slice(0, 2) === 'PR') {
          if (!(lncyear >= moment().year() - truckvo.lnYearsback)) {
            errMsg = constant.INVALID_DATE_YR.trim();
            const lcCdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} had Code Date ${lcDte} put in. This date was Incorrect as the year was not within ${truckvo.lnYearsback
                .toString()
                .trim()} yr back of ${moment().format(
                  'MM/DD/YYYY',
                )} \n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
              }`;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
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
            errMsg = constant.INVALID_DATE_YR.trim();
            const lcCdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} had Code Date ${lcDte} put in. This date was Incorrect as the year was not within ${truckvo.lnYearsback
                .toString()
                .trim()} yr back or 1 yr forward of ${moment().format(
                  'MM/DD/YYYY',
                )} \n PickCode is  ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
              }`;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
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
                .subtract(truckvo.lnYearsback, 'year')
              : moment().subtract(truckvo.lnYearsback, 'year');
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
            errMsg = constant.INVALID_DATE_YR.trim();
            const lcCdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} had Code Date ${lcDte} put in. This date was Incorrect as the year was not between ${lnshyear} and ${moment().year()} \n  PickCode is ${CODE2.fpickcode
              } Shelflife is ${CODE2.fshelflife}`;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
              'CODE DATE PROD > TODAY + 1',
              lcCdterr,
              true,
            );
          }
        }
        const ldPdate1 = moment(ldPdate, 'YYYY-MM-DD');
        const currentDate = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD');
        const t = ldPdate1.diff(currentDate, 'days');
        const a1 = truckvo.plFutureDate && CODE2.fpickcode.slice(0, 2) === 'PR';
        const a2 = t > 0;
        const a3 =
          CODE2.fpickcode.slice(0, 2) !== 'SB' && CODE2.fpickcode !== 'FIFO';
        if (errMsg === '' && !a1 && a2 && a3) {
          if (
            CODE2.fcustcode === truckvo.LOADIN.fcustcode &&
            truckvo.ffuturedte
          ) {
            const newDate = moment(currentDate, 'YYYY-MM-DD').add(1, 'days');
            if (ldPdate1 > newDate) {
              errMsg = constant.PROD_TODAY.trim();
              const lcCdterr = `Batch ${truckvo.lcBatch
                } \n Pallet ${truckvo.lcPal.padEnd(
                  20,
                  ' ',
                )} had Code Date ${lcDte} put in. \n The Production date is ${ldPdate.format(
                  'MM/DD/YYYY',
                )}. This date was Incorrect as the production date was > todays date ${moment().format(
                  'MM/DD/YYYY',
                )} +1 \n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
                }`;
              await this.WRITEINVCONTROL(
                fwho,
                truckvo,
                'CODE DATE PROD > TODAY + 1',
                lcCdterr,
                true,
              );
            }
          } else {
            errMsg = constant.PROD_TODAY.trim();
            const lcCdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} has Code Date ${lcDte} put in. \n The Production date is ${ldPdate.format(
                'MM/DD/YYYY',
              )}. This date was Incorrect as the production date was > todays date ${moment().format(
                'MM/DD/YYYY',
              )} \n PickCode is ${CODE2.fpickcode} Shelflife is ${CODE2.fshelflife
              }`;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
              'CODE DATE PRODUCTION > TODAY',
              lcCdterr,
              true,
            );
          }
        }

        if (truckvo.plIBRotationRestriction) {
          const result = await this.manager().query(`
          BEGIN
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
            result[0]?.pcNewestCodeDate &&
            result[0]?.pcNewestCodeDate !== '' &&
            cdt.isValid() &&
            cdt.format('YYYY') !== '1900' &&
            ldcDate < cdt
          ) {
            warnMsg = constant.ROTATION_RESTRICTION.trim();
            truckvo.curOper = TruckReceiveState.MARK_CHANGE_CODE_DATE;

            const chCdDate = getFields(TruckReceiveState.MARK_CHANGE_CODE_DATE);
            chCdDate.label = constant.CHANGE_CODE_DATE;
            chCdDate.avoidable = false;
            scrnUI.push(chCdDate);
            const lccdterr = `Batch ${truckvo.lcBatch
              } \n Pallet ${truckvo.lcPal.padEnd(
                20,
                ' ',
              )} had Code Date ${ldcDate.format(
                'MM/DD/YYYY',
              )} put in. \n  The newest Code Date received for that product is ${result[0].pcNewestCodeDate
              }
                  This date is a problem as it is older than the newest Date for the product Received. \n  PickCode is ${CODE2.fpickcode
              } Shelflife is ${CODE2.fshelflife}`;
            await this.WRITEINVCONTROL(
              fwho,
              truckvo,
              'INBOUND ROTATION RESTRICTION',
              lccdterr,
              false,
            );
            await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
            return new ResponseKeysDTO(
              plainToClass(PostResponseTruckReceiveDTO, {
                curOper: truckvo.curOper,
                errMsg,
                warnMsg,
                scrnUI,
                data,
              }),
              getOutFieldState(truckvo.curOper),
              '',
              '',
              `${constant.F5_EXIT}`,
            );
          }
        }

        if (
          errMsg === '' &&
          ldSbdateExp.diff(moment().tz(timeZoneIANA), 'days') + 1 <
          30 &&
          CODE2.fpickcode.slice(0, 2) === 'SB'
        ) {
          warnMsg = constant.EXP_DATE.trim();
          const lcCdterr = `Batch ${truckvo.lcBatch
            } \n Pallet ${truckvo.lcPal.padEnd(
              20,
              ' ',
            )} had Code Date ${lcDte} put in. \n The Sell By date is ${lcDte.slice(
              0,
              2,
            )}/${lcDte.slice(2, 4)}/${lcDte.slice(
              4,
            )}  This date is a problem as the Expiration date is < 30 days. \n PickCode is ${CODE2.fpickcode
            } Shelflife is ${CODE2.fshelflife}`;
          await this.WRITEINVCONTROL(
            fwho,
            truckvo,
            'CODE DATE EXPIRATION < 30',
            lcCdterr,
            false,
          );
        }
      } else {
        errMsg = constant.INVALID_CODE_DATE.trim();
      }
    }

    if (errMsg === '') {
      truckvo.lcDte = lcDte;
      const q = getFields(TruckReceiveState.MARK_PROCESS_QTY);
      q.badOneOfValidMsg = `${constant.QTY_TIE.trim()} ${truckvo.lnIntie} X ${truckvo.lnHigh
        } ${constant.OK_QUES.trim()}`;
      q.justDisplay = `${truckvo.lnIntie * truckvo.lnHigh}`;
      if (truckvo.llASNpal && truckvo.llASNpalNoQty === false) {
        let tempqty = Number(truckvo.lcQty).toString();
        tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
        q.defaultVal = tempqty;
        q.value = tempqty;
      } else {
        q.defaultVal = '';
        q.value = '';
      }
      scrnUI.push(q);
      outkey = 'qty';
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_QTY;

      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    } else {
      data = { CODE2: truckvo.CODE2 };
    }

    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        warnMsg,
        scrnUI,
        data,
      }),
      getOutputFields(outkey),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async ZERO(truckVo: TruckReceiveVO) {
    const truckvo = truckVo;
    await this.manager().query(
      `BEGIN
      DECLARE @countPHY_MST INT, @phyMstTrack CHAR(10), @idPHYTRN INT,  @phyMstSerial CHAR(4),   @fbatchPHYTRN CHAR(7), @fseqPHYTRN CHAR(3),
      @fseialPHYTRN CHAR(4) , @ftrackPHYTRN CHAR(10);
      SELECT  @phyMstTrack = FTRACK  , @phyMstSerial =  FSERIAL   FROM PHY_MST WHERE FPALLETID  = '${truckvo.lcPal}';
      SELECT @idPHYTRN = id, @fbatchPHYTRN = FBATCH, @fseqPHYTRN =  FSEQUENCE, @fseialPHYTRN = FSERIAL  , @ftrackPHYTRN  =  FTRACK
      from PHY_TRN WHERE FBATCH = '${truckvo.lcBatch}' AND FTRACK = @phyMstTrack AND FSERIAL = @phyMstSerial;
      DELETE FROM PHY_MST WHERE FPALLETID  = '${truckvo.lcPal}';
      UPDATE dbo.PHY_MST SET fmarriedpalletid=NULL,fpalletstack=NULL where fmarriedpalletid= '${truckvo.lcPal}';
      DELETE FROM [dbo].[PHY_DET] WHERE FBATCH= @fbatchPHYTRN AND FSEQUENCE=@fseqPHYTRN AND FTRACK=@ftrackPHYTRN AND FSERIAL=@fseialPHYTRN;
      DELETE FROM [dbo].[INV_MST] WHERE FBATCH= @fbatchPHYTRN AND FSEQUENCE=@fseqPHYTRN and not exists (select 1 from dbo.PHY_MST where ftrack= @ftrackPHYTRN);
      IF @@ROWCOUNT>0 DELETE FROM [dbo].[INV_TRN] where FBATCH= @fbatchPHYTRN AND FSEQUENCE= @fseqPHYTRN;
      DELETE FROM [dbo].[PHY_TRN] WHERE id=@idPHYTRN;
    END`,
    );
  }

  async getLoadSlot(fmbol: string, doorNumber: string) {
    const stageCr = await this.manager().query(
      `BEGIN select TRIM(floadslot) floadslot from STAGE where fmbol= '${fmbol}' and NOT floadslot = ''; END;`,
    );

    let lnLast = 0;
    if (stageCr.length > 0) {
      for (const element of stageCr) {
        if (element.floadslot.trim().length === 0) {
          continue;
        }
        const getDoor = Number(element.floadslot.trim().slice(-3));
        if (doorNumber.trim().slice(-1) === 'R') {
          if (getDoor % 2 !== 0) {
            continue;
          }
          if (lnLast < getDoor) {
            lnLast = getDoor;
          }
        } else {
          if (getDoor % 2 === 0) {
            continue;
          }
          if (lnLast < getDoor) {
            lnLast = getDoor;
          }
        }
      }
    }

    if (lnLast === 0) {
      const checkDoorLast = doorNumber.slice(-1) === 'R' ? '002' : '001';
      const tranformedDoor = String(Number(doorNumber.slice(0, -1))).padStart(
        3,
        '0',
      );
      return `${fmbol.trim()}${tranformedDoor}${checkDoorLast}`;
    } else {
      const loYesNo = '';
      const addWithLnLast = loYesNo === '' ? 2 : 0;
      const tranformedDoor = String(Number(doorNumber.slice(0, -1))).padStart(
        3,
        '0',
      );
      const lodSlotLastPart = String(lnLast + addWithLnLast).padStart(3, '0');
      return `${fmbol.trim()}${tranformedDoor}${lodSlotLastPart}`;
    }
  }

  async scanLocationScreen(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
    errorMsg: string,
  ) {
    const doorNumber = truckVo?.fdoornum.toString().padStart(3, '0');
    const crossDockType = truckVo.crossDockType;
    if (crossDockType === '3') {
      return await this.navigateToLoading(fwho, truckVo, '');
    }
    truckVo.curOper = TruckReceiveState.MARK_PALLET_SCAN_LOCATION;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckVo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: errorMsg,
        infoMsg: '',
        curOper: truckVo.curOper,
        scrnUI: [getFields(TruckReceiveState.MARK_PALLET_SCAN_LOCATION)],
        data: [
          {
            label: `${this.getInfoMessage(crossDockType, doorNumber)}`,
            value: '',
          },
        ],
      }),
      getOutputFields('lcScanDoor'),
      '',
      '',
      '',
    );
  }

  async driveToScanLocation(
    fwho: string,
    body: PostRequestTruckReceiveDTO,
    truckVo: TruckReceiveVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const { pnInput } = body;
    if (pnInput === '0') {
      // This is for the case when pallet tries to load and comes back from loading module due to exception.
      return await this.navigateToStagingFromLoading(fwho);
    }
    if (truckVo.crossDockType === '2') {
      //crossdock type will become 2 only when comes back from loading.
      return await this.scanLocationScreen(fwho, truckVo, constant, '');
    }
    let result = '';
    truckVo.QrdCrossdockallocate = true;
    const getQrd = await this.storedProceduresNewService.getQrdCrossdockallocate(
      {
        inFwho: fwho,
        inFpalletid: truckVo.lcPal,
        inHandloc: false,
        inHandpal: truckVo.handpal,
        inMachineid: truckVo.pcMachineID,
        returnmessage: result,
      },
    );

    if (getQrd && getQrd.output) {
      result = getQrd.output?.returnmessage;

      this.logger.debug(
        `TRUCK_RECEIVE --> driveToScanLocation | Start time ${moment().format(
          'HH:mm:ss-SSS',
        )} |  ${fwho} | ${truckVo.curOper} | ${result}`,
      );

      if (result !== 'SUCCESS') {
        truckVo.QrdCrossdockallocate = false;
      }

      return await this.scanLocationScreen(fwho, truckVo, constant, '');
    }

    return this.sendErrorMessage(
      truckVo,
      constant,
      TruckReceiveState.MARK_PALLET_INFO_MSG,
      'Error',
    );
  }

  async sendErrorMessage(
    truckVo: TruckReceiveVO,
    constant: any,
    curOper: string,
    errorMsg: string,
  ) {
    truckVo.curOper = curOper;
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: errorMsg,
        infoMsg: '',
        curOper: truckVo.curOper,
        data: '',
        label: '',
      }),
      getOutFieldState(truckVo.curOper),
      '',
      '',
      // `${constant.ENTER}`,
      '-ENTER',
    );
  }

  async sendInfoMessage(
    fwho: string,
    truckVo: TruckReceiveVO,
    infoMsg: string,
    footer: string,
    loadPallet: boolean,
  ) {
    truckVo.curOper = TruckReceiveState.MARK_PALLET_INFO_MSG;
    truckVo.loadPallet = loadPallet;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckVo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg: infoMsg,
        curOper: truckVo.curOper,
        data: '',
        label: '',
      }),
      getOutFieldState(truckVo.curOper),
      '',
      '',
      `${footer}`,
    );
  }

  getInfoMessage(cType: string, doorNumber: string) {
    let infoMsg = '';
    if (cType === '1') {
      infoMsg = 'Stage Pallet On Dock';
    } else if (cType === '2') {
      infoMsg = `Store at Stage Location \nNear Door ${doorNumber}`;
    } else if (cType === '3') {
      infoMsg = `Take to Door number ${doorNumber}`;
    }
    return infoMsg;
  }

  async infoMessageScreen(
    fwho: string,
    body: any,
    truckVo: TruckReceiveVO,
    constant: any,
  ) {
    const doorNumber = truckVo?.fdoornum.toString().padStart(3, '0');
    const infoMsg = this.getInfoMessage(truckVo.crossDockType, doorNumber);
    let loadPallet = false;
    const { crossDockType } = truckVo;

    if (crossDockType === '3') {
      loadPallet = true;
    }

    return this.sendInfoMessage(
      fwho,
      truckVo,
      infoMsg,
      // constant.ENTER,
      '-ENTER',
      loadPallet,
    );
  }

  async checkCrossDock(fwho: string, truckVo: TruckReceiveVO, constant: any) {
    const [quickRec] = await this.manager().query(
      `SELECT TOP 1 TRIM(fquickrcv) as fquickrcv FROM QUICKREC WHERE FINBATCH = '${truckVo.lcBatch}'`,
    );
    if (quickRec && quickRec.fquickrcv?.trim() === 'D') {
      const INV_MST_QUERY = `SELECT
            [im].[fbatch],
            [im].[fsequence]
         FROM  [edi_pal]   [ep]
            JOIN [inv_mst] [im] ON [ep].[fcustcode] = [im].[fcustcode]
              AND ep.fproduct=im.fproduct
              AND right(trim ( [ep].[fpalletid] ), 16) = [im].[flot] AND im.frectype='C'
         WHERE [ep].[fpalletid] = '${truckVo.lcPal}';`;

      const INV_MST = await this.manager().query(`BEGIN ${INV_MST_QUERY} END;`);

      if (INV_MST.length > 0) {
        truckVo.cdoBatch = INV_MST[0]?.fbatch;

        const LOADOUTQUERY = `SELECT DR.FDOOR, LO.FCONFIRMNM, LO.FDROPNUM, DR.FSCHEDDR, LO.FMBOL
          FROM LOADOUT AS LO LEFT JOIN DOORS AS DR  ON DR.FDOOR = LO.FDOOR WHERE LO.FBATCH='${INV_MST[0]?.fbatch}' AND DR.FSCHEDDR = 0;`;
        const LOADOUT = await this.manager().query(
          `BEGIN ${LOADOUTQUERY} END;`,
        );

        if (LOADOUT.length) truckVo.fdoornum = LOADOUT[0]?.FDOOR;
        if (LOADOUT.length === 0) {
          return [truckVo.fdoornum, '1', INV_MST[0]?.fbatch];
        } else {
          return [truckVo.fdoornum, '3', INV_MST[0]?.fbatch];
        }
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  async INCREATE(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let truckvo = truckVo;
    let palletID = truckvo.lcPal;
    const startTime = moment();
    this.logger.debug(
      `TRUCK_RECEIVE --> INCREATE | Start time ${moment().format(
        'HH:mm:ss-SSS',
      )} |  ${fwho} | ${truckvo.curOper}`,
      TruckReceiveService.name,
    );
    let lcJulian = '';
    let lcCddte = '';
    let errMsg = '';
    let warnMsg = '';
    let infoMsg = '';
    let scrnUI: any = [];
    let markResult = '';

    const { lcDte } = truckvo;
    lcJulian = truckvo.lcDteTyp === 'J' ? lcDte : '       ';
    let ldyear;
    if (truckvo.lcDteTyp === 'C' || truckvo.lcDteTyp === 'N') {
      ldyear =
        lcDte.trim().length === 6
          ? `${Number(lcDte.slice(4, 6)) < 96 ? '20' : '19'}${lcDte.slice(
            4,
            6,
          )}`
          : lcDte.slice(4, 8);
      lcCddte = `${ldyear}-${lcDte.slice(0, 2)}-${lcDte.slice(2, 4)}`;
      if (truckvo.lcDte.length === 6) {
        truckvo.lcDte = moment(truckvo.lcDte, 'MMDDYY').format('MMDDYYYY');
      }
      lcJulian = this.RFDTOJ(truckvo.lcDte);
    } else {
      lcJulian = lcDte;
      lcCddte = moment(this.RFJTOD(truckvo.lcDte), 'MMDDYYYY').format(
        'YYYY-MM-DD',
      );
    }

    let lcBbcddte = '';
    let lcBbjulian = '       ';
    const { lcBbdtetype } = truckvo;
    const { lcBbdte } = truckvo;
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
        lcBbjulian = truckvo.lcBBJULIAN;
      }
    }

    truckvo.lcEstb = truckvo.lcEstb
      .trim()
      .toUpperCase()
      .padEnd(15, ' ');
    truckvo.lcSlaughDte = truckvo.lcSlaughDte
      .trim()
      .toUpperCase()
      .padEnd(10, ' ');
    truckvo.lcClot = truckvo.lcClot
      .trim()
      .toUpperCase()
      .padEnd(16, ' ');
    const lcSendDtetyp = truckvo.lcDteTyp === 'N' ? 'C' : truckvo.lcDteTyp;
    const CODE2 = (truckvo.CODE2 as unknown) as Code2;

    // line 2803 to 2879 && batch,lot,prodouct found
    let llk1exist = false;
    if (truckvo.lcLot.trim().length === 0) {
      llk1exist = true;
    }

    if (llk1exist) {
      if (truckvo.lcDteTyp === 'J') {
        const INV_MST1 = await this.invMstRepo().findOne({
          fbatch: truckvo.lcBatch,
          fproduct: truckvo.lcProd,
          festnum: truckvo.lcEstb,
          fslaughdte: truckvo.lcSlaughDte,
          fcustlot: truckvo.lcClot,
          fjuliandte: lcBbjulian,
          fbbcodedte:
            truckvo.lcBbdte?.length > 0
              ? moment(truckvo.lcBbdte, 'MMDDYYYY').format('YYYY-MM-DD')
              : '',
          flot: truckvo.lcLot,
        });
        if (INV_MST1) {
          llk1exist = true;
          truckvo.lcLot = INV_MST1.flot;
        }
      } else {
        const INV_MST2 = await this.invMstRepo().findOne({
          fbatch: truckvo.lcBatch,
          fproduct: truckvo.lcProd,
          festnum: truckvo.lcEstb,
          fslaughdte: truckvo.lcSlaughDte,
          fcustlot: truckvo.lcClot,
          fcodedte: lcCddte,
          fbbcodedte:
            truckvo.lcBbdte?.length > 0
              ? moment(truckvo.lcBbdte, 'MMDDYYYY').format('YYYY-MM-DD')
              : '',
          flot: truckvo.lcLot,
        });
        if (INV_MST2) {
          llk1exist = true;
          truckvo.lcLot = INV_MST2.flot;
        }
      }
    }
    let receivePlatformType = false;
    const CONFIG = (truckvo.CONFIG as unknown) as Config;
    if (CONFIG && CONFIG?.receivePlatformType) {
      receivePlatformType = CONFIG.receivePlatformType;
    }
    if (Number(truckvo.lcQty) !== 0) {
      if (truckvo.curOper !== TruckReceiveState.MARK_VERIFY_PALLET) {
        const result = await this.storedProceduresNewService.getInboundsIncreate({
          inCode2Id: CODE2.id,
          inFbatch: truckvo.lcBatch,
          inFhold: CODE2.fhold,
          inProd: truckvo.lcProd
            .trim()
            .toUpperCase()
            .padEnd(16, ' '),
          inLot: truckvo.lcLot
            .trim()
            .toUpperCase()
            .padEnd(16, ' '),
          inBatchprodedistatus: truckvo.llBatchProdEdiStatus,
          inGlOfcputflag: CONFIG?.ofcputflag === true,
          inLcBbcddte: lcBbcddte.length > 0 ? lcBbcddte : null,
          inLcBbdtetype: truckvo.lcBbdtetype,
          inLcBbjulian: lcBbjulian.padEnd(7, ' '),
          inLcCustcode: truckvo.lcCustCode.padEnd(10, ' '),
          inLcCustpal: truckvo.lcCustpal.padEnd(20, ' '),
          inLcCddte: lcCddte,
          inLcClot: truckvo.lcClot,
          inLcCoolcode: truckvo.lcCoolCode,
          inLcEstb: truckvo.lcEstb,
          inLcPal: truckvo.lcPal.padEnd(20, ' '),
          inLcInit: fwho.padEnd(7, ' '),
          inLcJulian: lcJulian,
          inLcQty: truckvo.lcQty.padEnd(5, ' '),
          inLcRef: truckvo.lcRef.padEnd(15, ' '),
          inLcSlaughdte: truckvo.lcSlaughDte.padEnd(10, ' '),
          inLcDtetyp: lcSendDtetyp,
          inLlQuickrcv: truckvo.llQuickrcv,
          inLlYywwdcool: truckvo.ywwdcool,
          inDatetime: this.facilityService.getFacilityCurrentDateTimeFormatted('MM/DD/YYYY HH:mm:ss'),
          inLnTemp: (Number.isNaN(truckvo.lcTemp) ? 0 : Number(truckvo.lcTemp))
            .toString()
            .padEnd(8, ' '),
          inLcFtie: (Number.isNaN(truckvo.lnIntie) ? 0 : Number(truckvo.lnIntie))
            .toString()
            .padEnd(3, ' '),
          inLcFlength: (Number.isNaN(truckvo.pnLength)
            ? 0
            : Number(truckvo.pnLength)
          )
            .toString()
            .padEnd(10, ' '),
          inLcFwidth: (Number.isNaN(truckvo.pnWidth)
            ? 0
            : Number(truckvo.pnWidth)
          )
            .toString()
            .padEnd(10, ' '),
          inLcFheight: (Number.isNaN(truckvo.pnHeight)
            ? 0
            : Number(truckvo.pnHeight)
          )
            .toString()
            .padEnd(10, ' '),
        });
        // && display the lot number
        let inLot = truckvo.lcLot;
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
                `SELECT TOP 1 FLOT as flot from INV_MST WHERE  FBATCH = '${truckvo.lcBatch}' order by SQLDATETIME DESC;`,
              );
            if (INV_MST && INV_MST.length > 0 && INV_MST[0].flot) {
              inLot = INV_MST[0].flot;
            }
            truckvo.lcLot = inLot.trim();
          } else {
            truckvo.lcLot = inLot;
          }
        }
        warnMsg = `${constant.LOT.trim()} ${truckvo.lcLot}`;
      }

      truckvo = await this.beltPrinterservice.loadLabels<TruckReceiveVO>(
        fwho,
        truckvo,
        ModuleNameEnum.TRUCK_RECEIVE,
      );
      //retreive dynamic attribute value and save in the corresponding table
      if (body?.dynamicAttr) {
        const dynamicAttrValues = await this.dynamicAttributesService.processDynamicAttributes(
          this.manager(),
          truckvo.lcCustCode,
          truckvo.lcProd,
          body.dynamicAttr,
          truckvo.lcBatch,
        );
        await this.dynamicAttributesService.saveDynamicAttributes(
          this.manager(),
          dynamicAttrValues,
          truckvo.lcBatch,
          palletID,
          fwho,
        );
      }
      const customer = await this.manager().query(
        `SELECT c.InboundPalletLabel FROM Customer c WHERE FCUSTCODE = '${truckvo.LOADIN?.fcustcode}'`,
      );
      if (
        truckvo.curOper !== TruckReceiveState.MARK_VERIFY_PALLET &&
        !truckvo.llIscatch &&
        !truckvo.skipLabelCheck &&
        (truckvo.labelsList.length > 0 ||
          truckvo.noScanLabels.length > 0 ||
          (((customer && customer[0]?.InboundPalletLabel?.trim()) ||
            truckvo.plUsedF8) &&
            body.sndPal &&
            ['Y', ''].includes(body.sndPal.trim().toUpperCase())))
      ) {
        return await this.beltPrinterservice.printerScreen<TruckReceiveVO>(
          fwho,
          truckvo,
          truckvo.lcPal,
          warnMsg,
          ModuleNameEnum.TRUCK_RECEIVE,
          'processSendPallet',
          constant,
        );
      }

      const [quickRec] = await this.manager().query(
        `SELECT TOP 1 TRIM(fquickrcv) as fquickrcv FROM QUICKREC WHERE FINBATCH = '${truckVo.lcBatch}'`,
      );
      const checkXdock = await this.checkCrossDock(fwho, truckvo, constant);
      if (
        truckvo.llIscatch &&
        truckvo.curOper !== TruckReceiveState.MARK_VERIFY_PALLET
      ) {
        // && see if is a catchweight

        truckvo.lcQty = Number.isNaN(truckvo.lcQty) ? '-9' : truckvo.lcQty;
        truckvo.lcCustpal = truckvo.lcCustpal.toUpperCase();
        truckvo.lcPal = truckvo.lcPal.toUpperCase();

        let plFoundEDIPallet: boolean = false;
        const rfInbounds = await this.storedProceduresNewService.getRfInboundsedicatchweights(
          {
            batch: truckvo.lcBatch,
            foundedipallet: '',
            lot: truckvo.lcLot,
            palletid: truckvo.lcPal,
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
          errMsg = constant.WEIGHTS_SYS.trim();
          if (
            truckvo.curOper !== TruckReceiveState.MARK_VERIFY_PALLET &&
            (truckvo.labelsList.length > 0 ||
              truckvo.noScanLabels.length > 0 ||
              (((customer && customer[0]?.InboundPalletLabel?.trim()) ||
                truckvo.plUsedF8) &&
                body.sndPal &&
                ['Y', ''].includes(body.sndPal.trim().toUpperCase())))
          ) {
            truckvo.curOper = TruckReceiveState.MARK_BELT_PRINTER;
            scrnUI.push(...this.printerSummary(truckvo));
          } else if (receivePlatformType) {
            truckvo.curOper = TruckReceiveState.MARK_PALLET_TYPE;
          }
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        } else {
          const cvo: CatchWeightVO = new CatchWeightVO();
          cvo.originator = TRUCKRECEIVE;
          cvo.palId = truckvo.lcPal;
          cvo.prdCde = truckvo.lcProd || truckvo?.curCode2?.FPRODUCT;
          cvo.tlOBCatch = false;
          cvo.tcbatch = truckvo.lcBatch;
          cvo.tcseq = 'false';
          cvo.tcSupresFullPalWgt = truckvo.plUnmatchedAsnQty;

          if (!truckvo.llQuickrcv) {
            if (receivePlatformType) {
              truckvo.curOper = TruckReceiveState.MARK_PALLET_TYPE;
            } else {
              markResult = await this.processPallHist(fwho, truckvo, constant);
            }
          } else {
            truckvo.curOper = TruckReceiveState.QUICK_RECV_AFTER_CATCH_WGT;
            // markResult = await this.processPallHistQuickRec(fwho, truckvo);
          }
          // }

          const hasBeltprinter =
            truckvo.labelsList.length > 0 ||
            truckvo.noScanLabels.length > 0 ||
            (((customer && customer[0]?.InboundPalletLabel?.trim()) ||
              truckvo.plUsedF8) &&
              body.sndPal &&
              ['Y', ''].includes(body.sndPal.trim().toUpperCase()));
          if (hasBeltprinter) {
            truckvo.curOper = TruckReceiveState.MARK_BELT_PRINTER;
            scrnUI.push(...this.printerSummary(truckvo));
          }
          await this.cacheService.set2Obj(
            fwho,
            TRUCKRECEIVE,
            truckvo,
            'CATCHWEIGHT',
            cvo,
          );
          infoMsg = 'CATCHWEIGHT';
        }
      } else if (truckvo.curOper === TruckReceiveState.MARK_BELT_PRINTER) {
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      } else if (receivePlatformType) {
        truckvo.curOper = TruckReceiveState.MARK_PALLET_TYPE;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      } else {
        markResult = await this.processPallHist(fwho, truckvo, constant);
      }
      if (
        truckvo.curOper !== TruckReceiveState.MARK_BELT_PRINTER &&
        !receivePlatformType &&
        quickRec &&
        quickRec.fquickrcv?.trim() === 'D' &&
        checkXdock.length
      ) {
        const [fdoornum, crossdocktype, cdobatch] = checkXdock;
        truckvo.fdoornum = fdoornum;
        truckvo.crossDockType = crossdocktype;
        truckvo.cdoBatch = cdobatch;
        if (infoMsg !== 'CATCHWEIGHT') {
          return await this.infoMessageScreen(fwho, {}, truckvo, constant);
        } else if (truckvo.curOper === TruckReceiveState.MARK_BELT_PRINTER) {
          truckvo.curOper = TruckReceiveState.MARK_BELT_PRINTER;
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
          return new ResponseKeysDTO(
            plainToClass(PostResponseTruckReceiveDTO, {
              curOper: truckvo.curOper,
              errMsg,
              infoMsg,
              warnMsg,
              scrnUI,
            }),
            getOutFieldState(truckvo.curOper),
            '',
            '',
            `${!truckvo.plUsedF8 ? constant.F2_SKIP.trim() : ''}`,
          );
        } else {
          truckvo.curOper = TruckReceiveState.MARK_PALLET_INFO_MSG_CW;
          await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
          return new ResponseKeysDTO(
            plainToClass(PostResponseTruckReceiveDTO, {
              curOper: truckvo.curOper,
              errMsg,
              infoMsg,
              warnMsg,
              scrnUI,
            }),
            getOutFieldState(truckvo.curOper),
            '',
            '',
            `${constant.F5_EXIT}~${constant.F8_LABL}`,
          );
        }
      }
    } else {
      await this.ZERO(truckvo);
      warnMsg = constant.PALLET_CANCELLED.trim();
      if (receivePlatformType) {
        truckvo.curOper = TruckReceiveState.MARK_PALLET_TYPE;
      } else {
        markResult = await this.processPallHist(fwho, truckvo, constant);
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    }

    this.logger.debug('Truck-receive -->', `${markResult}, ${truckvo.curOper}`);

    if (truckvo.curOper !== TruckReceiveState.MARK_BELT_PRINTER) {
      truckvo.curOper =
        markResult?.trim().length > 0 ? markResult : truckvo.curOper;
    }

    if (infoMsg !== 'CATCHWEIGHT' && truckvo.llQuickrcv) {
      const result = await this.QUICKOUT(fwho, truckvo, constant, warnMsg);
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD) {
        truckvo.lcPal = '';
        truckvo.QuickReciverDone = false;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      }
      return result;
    }
    if (truckvo.lcIsBlast !== 'Y') {
      await this.SEEIFXDOCK(truckvo);
    }

    this.logger.debug(
      `Truck-receive --> INCREATE | End time ${moment().format(
        'HH:mm:ss-SSS',
      )} |  ${fwho} | ${truckvo.curOper}`,
      TruckReceiveService.name,
    );
    this.logger.debug(
      `Truck-receive --> INCREATE | Elapsed time ${moment().diff(
        startTime,
      )} ms | OUT Time ${moment().format('HH:mm:ss-SSS')} |  ${fwho} | ${truckvo.curOper
      }`,
      TruckReceiveService.name,
    );

    if (markResult === TruckReceiveState.MARK_PROCESS_PROD) {
      const prodField = getFields(TruckReceiveState.MARK_PROCESS_PROD);
      prodField.hideUntilEnabled = false;
      scrnUI.push(prodField);
    }
    if (
      warnMsg === `${constant.LOT.trim()} ${truckvo.lcLot}` &&
      (infoMsg !== 'CATCHWEIGHT' ||
        truckvo.curOper !== TruckReceiveState.MARK_BELT_PRINTER)
    ) {
      // warnMsg = ''
      warnMsg = `${constant.LOT.trim()} ${truckvo.lcLot.trim()}`;
    }
    let footer =
      truckvo.curOper === TruckReceiveState.MARK_BELT_PRINTER
        ? `${constant.F2_SKIP}`
        : truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
          ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
          ? `${constant.F5_EXIT}`
          : truckvo.lineageFreightManagement
            ? `${constant.F5_EXIT}`
            : `${constant.F5_EXIT}~${constant.F8_LABL}`;
    const data =
      truckvo.quickRec && ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
        ? { batch: '' }
        : { batch: truckvo.lcBatch };
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg,
        infoMsg,
        warnMsg,
        scrnUI,
        data,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      truckvo.curOper === TruckReceiveState.MARK_BELT_PRINTER
        ? `${constant.F2_SKIP}`
        : truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
          truckvo.lineageFreightManagement &&
          ['L', 'D', 'S'].includes(truckvo.quickRec.fquickrcv)
          ? `${constant.F5_EXIT}`
          : `${constant.F5_EXIT}~${constant.F8_LABL}`,
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

      this.logger.debug(
        `Truck-receive --> InboundData --> ${InboundData?.output}`,
        TruckReceiveService.name,
      );
      const pcXml: string = '';
      /* let pcXml: string = '';
      if (InboundData && InboundData.output && InboundData.output) {
        const i = InboundData.output;
        pcXml = `<?xml version = "1.0" encoding="Windows-1252" standalone="yes"?>` +
          `<VFPData>
          <inbound>
            <lpn>${i.lpn}</lpn>
            <facility_id>${i.facility_id}</facility_id>
            <sku>${i.sku}</sku>
            <case_quantitiy>${i.case_quantitiy}</case_quantitiy>
            <product_group>${i.product_group}</product_group>
            <item_description>${i.item_description}</item_description>
            <customer_name>${i.customer_name}</customer_name>
            <customer_code>${i.customer_code}</customer_code>
            <primary_from>${i.primary_from}</primary_from>
            <primary_to>${i.primary_to}</primary_to>
          </inbound>
        </VFPData>
        `;
      } */

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
            TruckReceiveService.name,
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
    truckVo: TruckReceiveVO,
    pcPid: string,
    fshort: string,
  ): Promise<boolean> {
    const truckvo = truckVo;
    let result = false;
    const CONFIG = (truckvo.CONFIG as unknown) as Config;
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
            inPalltype: fshort
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

  async changeCodeDate(
    fwho: string,
    truckvo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    let infoMsg;
    const scrnUI = [];
    let outkey = 'qty';
    truckvo.curOper =
      body?.lckeepCdDate?.trim()?.toUpperCase() === 'Y'
        ? TruckReceiveState.MARK_PROCESS_DATE
        : TruckReceiveState.MARK_PROCESS_QTY;
    if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_QTY) {
      // truckvo.lc_dte = lcDte;
      const q = getFields(TruckReceiveState.MARK_PROCESS_QTY);
      q.badOneOfValidMsg = `${constant.QTY_TIE} ${truckvo.lnIntie} X ${truckvo.lnHigh} ${constant.OK_QUES}`;
      q.justDisplay = `${truckvo.lnIntie * truckvo.lnHigh}`;
      if (truckvo.llASNpal && truckvo.llASNpalNoQty === false) {
        let tempqty = Number(truckvo.lcQty).toString();
        tempqty = tempqty !== 'NaN' && tempqty !== '0' ? tempqty : '';
        q.defaultVal = tempqty;
        q.value = tempqty;
      } else {
        q.defaultVal = '';
        q.value = '';
      }
      scrnUI.push(q);
      // const outkey = 'qty';
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_QTY;
    } else {
      truckvo.curOper = TruckReceiveState.MARK_PROCESS_DATE;
      outkey = truckvo.lcDteTyp === 'J' ? 'julinDate' : 'codeDate';
      const d = getFields(
        truckvo.lcDteTyp === 'J'
          ? TruckReceiveState.SHOW_PROCESS_JDATE
          : TruckReceiveState.SHOW_PROCESS_CDATE,
      );
      scrnUI.push(d);
    }

    const qyn = getFields(TruckReceiveState.MARK_CHANGE_CODE_DATE);
    qyn.avoidable = true;
    scrnUI.push(qyn);

    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg,
        curOper: truckvo.curOper,
        scrnUI,
      }),
      getOutputFields(outkey),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

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

  summary2(truckvo: TruckReceiveVO): Field[] {
    const scrnUi = [];
    const tie = getObjFields('ti');
    tie.defaultVal = truckvo.lnIntie.toString();
    tie.value = truckvo.lnIntie.toString();

    const length = getObjFields('lngth');
    length.defaultVal = truckvo.pnLength.toString();
    length.value = truckvo.pnLength.toString();

    const width = getObjFields('width');
    width.defaultVal = truckvo.pnWidth.toString();
    width.value = truckvo.pnWidth.toString();

    const height = getObjFields('height');
    height.defaultVal = truckvo.pnHeight.toString();
    height.value = truckvo.pnHeight.toString();
    // palletID,
    scrnUi.push(tie, length, width, height);

    return scrnUi;
  }

  summary(truckvo: TruckReceiveVO): Summary[] {
    const s: Summary[] = [
      {
        label: getLabelFields('batNoView'),
        rawID: 'batNoView',
        value: truckvo.lcBatch,
      },
      {
        label: getLabelFields('palletID'),
        rawID: 'palletID',
        value: truckvo.lcPal,
      },
    ];
    if (truckvo.lcHasCust === 'Y') {
      s.push({
        label: getLabelFields('custPalletID'),
        rawID: 'custPalletID',
        value: truckvo.lcCustpal,
      });
    }
    s.push(
      {
        label: getLabelFields('product'),
        rawID: 'product',
        value: truckvo.lcProd,
      },
      {
        label: getLabelFields(
          truckvo.lcDteTyp === 'J' ? 'julinDate' : 'codeDate',
        ),
        rawID: truckvo.lcDteTyp === 'J' ? 'julinDate' : 'codeDate',
        value: truckvo.lcDte,
        displayFormat: truckvo.lcDteTyp === 'J' ? 'julian' : 'date',
      },
      {
        label: getLabelFields('qty'),
        rawID: 'qty',
        value: truckvo.lcQty,
        displayFormat: 'numeric',
      },
    );
    if (!truckvo.llUsedF6 && truckvo.llIsHPPIn) {
      s.push({
        label: getLabelFields('hpp'),
        rawID: 'hpp',
        value: truckvo.lcIsHPP,
      });
    } else {
      s.push({
        label: getLabelFields('blast'),
        rawID: 'blast',
        value: truckvo.lcIsBlast1,
      });
    }
    if (truckvo.lcKeyLot === 'Y') {
      s.push({
        label: getLabelFields('lot'),
        rawID: 'lot',
        value: truckvo.lcLot,
      });
    }
    if (truckvo.lcHasLot === 'Y') {
      s.push({
        label: getLabelFields('clot'),
        rawID: 'clot',
        value: truckvo.lcClot,
      });
    }
    if (truckvo.lcKeyEstb === 'Y') {
      s.push({
        label: getLabelFields('estb'),
        rawID: 'estb',
        value: truckvo.lcEstb,
      });
    }
    if (truckvo.lcKeyEstb === 'Y' && !truckvo.llUsedF6) {
      s.push({
        label: getLabelFields('slaughDate'),
        rawID: 'slaughDate',
        value: truckvo.lcSlaughDte,
        displayFormat: truckvo.lcSlaughDte?.length === 7 ? 'julian' : 'date',
      });
    }
    if (truckvo.lcKeyRef === 'Y' && !truckvo.llUsedF6) {
      s.push({
        label: getLabelFields('ref'),
        rawID: 'ref',
        value: truckvo.lcRef,
      });
    }
    if (truckvo.lcKeyTmp === 'Y' && !truckvo.llUsedF6) {
      s.push({
        label: getLabelFields('temp'),
        rawID: 'temp',
        value: truckvo.lcTemp,
      });
    }
    if (truckvo.lcBbdtetype.trim() !== '' && !truckvo.llUsedF6) {
      s.push({
        label:
          truckvo.lcBbdtetype === '1'
            ? getLabelFields('bbjDte')
            : getLabelFields('bbcDte'),
        rawID: truckvo.lcBbdtetype === '1' ? 'bbjDte' : 'bbcDte',
        value:
          truckvo.lcBbdtetype === '1' ? truckvo.lcBBJULIAN : truckvo.lcBbdte,
        displayFormat: truckvo.lcBbdtetype === '1' ? 'julian' : 'date',
      });
    }
    if (truckvo.llIsConsCross) {
      s.push({
        label: getLabelFields('consig'),
        rawID: 'consig',
        value: truckvo.lcConscode,
      });
    }
    return s;
  }

  async processMachineId(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
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
      data = validateOutMessage?.out_message;
    }
    if (
      data &&
      data.length > 0 &&
      data
        .toString()
        .trim()
        .toUpperCase() === 'PASS'
    ) {
      const [AUTHRIZE] = await this.manager().query(
        `Select id from Authrize where finitials = '${fwho}'`,
      );
      let userData: any;
      if (AUTHRIZE) {
        AUTHRIZE.fmhe = body.eqId;
        AUTHRIZE.zone = '';
        await this.manager().query(
          `UPDATE Authrize SET fmhe = '${body.eqId}',  ZONE = '' where finitials = '${fwho}'`,
        );
        userData = await this.cacheService.getUserData(fwho);
        userData.pcMachineID = body.eqId;
        userData.userID = fwho;
        await this.cacheService.setUserData(fwho, userData);
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PALLET;
        truckvo.lcInMachineID = body.eqId;
        truckvo.prevCurOper = '';
      }
      //       console.log('validate Machine called', userData.userID);
    } else if (data && data.length > 0) {
      errMsg = data.toString().trim();
    }
    /**
     * New code added for ecert to get all rf versions
     */
    /**
     * New code added for ecert to get all rf versions
     */
    let RFREQ: Rfreq;
    let RFREQNEW: Rfreq[] = [];
    const configCheck = await this.dynamicAttributesService.configCheck(this.manager());
    if (configCheck.length > 0 && configCheck[0]?.USE_BARCODE_SCANNING_MAINTENANCE) {
      RFREQNEW = await this.dynamicAttributesService.getRfInfoVersions(this.manager(), truckvo?.LOADIN?.fcustcode, truckvo?.LOADIN?.fconsignor) as Rfreq[];
      RFREQ = RFREQNEW[0];
      truckvo.RFREQ = RFREQ;
    }
    else {
      RFREQ = truckvo.RFREQ;
    }
    // truckvo.RFREQ = RFREQ;
    if (RFREQ) {
      truckvo.lcKeyLot = RFREQ?.fkeylot?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyEstb = RFREQ?.fltestbnum?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyRef = RFREQ?.fkeyref?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyTmp = RFREQ?.fkeytemp?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.llUse128Barcode = RFREQ.fuse128Bar;
      truckvo.lnBarcodeScanLength = RFREQ.fscanlngth;
      truckvo.ywwdcool = RFREQ.fyywwdcool ? RFREQ.fyywwdcool : false;
      truckvo.llASNpal = RFREQ.fedipal ? RFREQ.fedipal : false;
      truckvo.llASNpalNoQty = RFREQ.edipalnoqty ? RFREQ.edipalnoqty : false;
      truckvo.lnCustomerPIDLength = RFREQ.CustomerPIDLength;
      truckvo.plAutoFillConsignee = RFREQ.AutoFillConsignee;
    }
    const scanInfo = {
      lc_keylot: truckvo.lcKeyLot,
      lc_keyestb: truckvo.lcKeyEstb,
      lc_keyref: truckvo.lcKeyRef,
      llUse128Barcode: truckvo.llUse128Barcode,
      lnBarcodeScanLength: truckvo.lnBarcodeScanLength,
      ll_yywwdcool: truckvo.ywwdcool,
      ll_ASNpal: truckvo.llASNpal,
      plAlt128Check: truckvo.plAlt128Check,
      ll_ASNpalNoQty: truckvo.llASNpalNoQty,
    };
    const dataObj = {
      CODE2: truckvo.CODE2,
      RFREQ: truckvo.RFREQ,
      scanInfo,
      RFREQNEW,
      batch: ''
    };

    const scrnUI = [];
    const palField = getFields(TruckReceiveState.MARK_PROCESS_PALLET);
    if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
      palField.maxFieldLen = truckvo.RFREQ.fscanlngth;
    }
    scrnUI.push(palField);

    const batchField = getFields(TruckReceiveState.SHOW_PROCESS_BATCH);
    batchField.defaultVal = truckvo.lcBatch?.trim();
    batchField.value = truckvo.lcBatch?.trim();
    scrnUI.push(batchField);

    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg,
        infoMsg: '',
        curOper: truckvo.curOper,
        data: dataObj,
        scrnUI,
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
        ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
        ? `${constant.F5_EXIT}`
        : truckvo.lineageFreightManagement
          ? `${constant.F5_EXIT}`
          : `${constant.F5_EXIT}~${constant.F8_LABL}`,
    );
  }

  async quickReceiverAfterCatchWgt(
    fwho: string,
    truckVo: TruckReceiveVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    const truckvo = truckVo;
    let receivePlatformType = false;
    const CONFIG = (truckvo.CONFIG as unknown) as Config;
    if (CONFIG && CONFIG?.receivePlatformType) {
      receivePlatformType = CONFIG.receivePlatformType;
    }
    if (receivePlatformType) {
      truckvo.curOper = TruckReceiveState.MARK_PALLET_TYPE;
    } else {
      await this.processPallHistQuickRec(fwho, truckvo);
      let CheckForStackable = false;
      if (await this.CheckForStackable(truckvo.lcBatch, truckvo.lcPal)) {
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_GET_MOD;
        CheckForStackable = true;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        // result = truckvo.curOper;
        // return result;
      }
      const config = (truckvo.CONFIG as unknown) as Config;
      const glPutDuringRec = config ? config.putAwayDuringReceiving : false;
      if (glPutDuringRec && !CheckForStackable) {
        truckvo.pcPutAway = 'N';
        truckvo.curOper = TruckReceiveState.MARK_PROCESS_PUT_AWAY;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
        // result = truckvo.curOper;
        // return result;
      }
      if (
        truckvo.curOper !== TruckReceiveState.MARK_PROCESS_GET_MOD &&
        truckvo.curOper !== TruckReceiveState.MARK_PROCESS_PUT_AWAY
      ) {
        await this.processLastPallet(fwho, truckvo, constant);
      }
    }
    if (truckvo.llQuickrcv) {
      const result = await this.QUICKOUT(fwho, truckvo, constant, '');
      if (truckvo.curOper === TruckReceiveState.MARK_PROCESS_PROD) {
        truckvo.lcPal = '';
        truckvo.QuickReciverDone = false;
        await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      }

      return result;
    }
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg: '',
        infoMsg: '',
        warnMsg: '',
      }),
      getOutFieldState(truckvo.curOper),
      '',
      '',
      `${constant.F5_EXIT}`,
    );
  }

  async checkLocOrDoor(truckVo: TruckReceiveVO, flocation: string) {
    let doorQry = `SELECT LO.FDOOR FROM LOADOUT LO JOIN DOORS D ON D.FDOOR = LO.FDOOR  WHERE FBATCH = @0 AND LO.FDOOR = @1`;

    if (flocation.length <= 3 && Number(flocation)) {
      // check valid door number
      const result = await this.manager().query(`BEGIN ${doorQry} END;`, [
        truckVo.cdoBatch,
        flocation,
      ]);
      return result.length;
    } else if (flocation.length === 10) {
      // check valid location
      const checkStageLocation = await this.manager()
        .query(`BEGIN SELECT TOP 1 flocation
            FROM LOCATION
            WHERE FLOCATION = '${flocation}' AND FSTORETYPE = 'S'
          END;`);
      return checkStageLocation.length;
    } else {
      // invalid location
      return false;
    }
  }

  async updatePhyMstAndStageLocations(
    fwho: string,
    body: PostRequestTruckReceiveDTO,
    truckVO: TruckReceiveVO,
    constant: any,
  ): Promise<any> {
    try {
      let { lcScanDoor } = body;
      const { handloc } = body;
      const { lcPal, handpal, QrdCrossdockallocate } = truckVO;

      const checkStageLocation = await this.checkLocOrDoor(truckVO, lcScanDoor);
      if (!checkStageLocation) {
        return await this.scanLocationScreen(
          fwho,
          truckVO,
          constant,
          'Invalid Location',
        );
      }

      lcScanDoor =
        lcScanDoor.length <= 3
          ? `DR${lcScanDoor.trim().padStart(3, '0')}`
          : lcScanDoor;

      let updatePhyMstStage = '';
      updatePhyMstStage = `UPDATE PHY_MST SET FLOCATION = '${lcScanDoor}', fwho = '${fwho}' WHERE [FPALLETID] = '${lcPal}';`;
      if (QrdCrossdockallocate) {
        updatePhyMstStage = `${updatePhyMstStage} UPDATE STAGE SET FLOCATION = '${lcScanDoor}', FHANDLOC = '${handloc ? 1 : 0
          }', FHANDPAL='${handpal ? 1 : 0}' WHERE [FCUBEDID] = '${lcPal}';`;
      }
      await this.manager().query(`BEGIN ${updatePhyMstStage}; END;`);

      const locToVal = await this.manager().query(
        `BEGIN SELECT TOP 1 FLOCTO FROM PALLHIST WHERE FPALLETID = '${lcPal}' ORDER BY ID DESC END;`,
      );
      let locTo = lcScanDoor;
      if (locToVal.length > 0) {
        locTo = locToVal[0].FLOCTO;
      }

      const fdateStamp = this.facilityService.getFacilityCurrentDateTimeFormatted('YYYY-MM-DD HH:mm:ss.SSS');
      await this.manager().query(
        `BEGIN INSERT INTO PALLHIST (fworktype,fpalletid,flocfrom,flocto,foperid,fdatestamp,fequipid,fhandloc,fhandpal, fcustcode,fbatch) VALUES
         ('XDOCKTRUCK','${lcPal}','${locTo}','${lcScanDoor}','${fwho}','${fdateStamp}','${truckVO.pcMachineID
        }',${handloc ? 1 : 0},${handpal ? 1 : 0},'${truckVO.lcCustCode}','${truckVO.cdoBatch
        }'); END;`,
      );

      await this.autoReceiveXdock(fwho, truckVO, constant);
    } catch (error) {
      this.logger.debug(
        { error },
        'Truck-receive --> updatePhyMstAndStageLocations',
      );
    }
  }

  async processNavigateToPalletIdScreen(
    fwho: string,
    pcConfirmationNumber: string,
    truckvo: TruckReceiveVO,
    constant: any,
    infoMsg: string = '',
  ) {
    let loadin = [];
    const loadinconf = `
      SELECT TOP 1 id, fbatch, TRIM(fcustcode) as fcustcode, TRIM(fowner) as fowner, fsupplynum, fsupplynme, fbdate,
      floadnum, freference, fcarrier, fcheckqty, fcheckgros, fcomment, fccomment, fnotes, fltime, fshipstat, finuse,
      ftranmeth, fseal, ftrailer, fponum, favgtemp, ffronttemp, fmidtemp, fbacktemp, fdoornum, fbilldoc, fprinted,
      ftrancust, feditype, fpalexchng, fpalcond, floadoptcd, fdtecngrsn, fcarchgrsn, fversion, fpallets, fchep, fedi,
      fedisnddte, fedisndtme, foedi, foedisdte, foedistme, fscanstat, TRIM(fscanwho) as fscanwho, fscanstdte,
      fscanendte, fscanentme, farrivedte, farrivetme, fstartdte, fstarttme, ffinishdte, ffinishtme, fcolrcvd, fcolshort,
      fcoldamage, fcolover, fcolother, fcolcoment, ffrzrcvd, ffrzshort, ffrzdamage, ffrzover, ffrzother, ffrzcoment,
      fdryrcvd, fdryshort, fdrydamage, fdryover, fdryother, fdrycoment, fconfirmnm, flivedrop,fschcoment, fsignintme,
      fsignindte, fdriver, fwho, fdatestamp, ftimestamp, fwhorcvd, frcvddte, frcvdtme, fconfwhen, fconfwho, fchepcust,
      fgroupcode, fcpc, fconsignor, TRIM(foutbatch) foutbatch, fhasxdock, fedi947, f9edisdte, f9edistme, forgsched,
      fcrtebymod, festnum, fo_arivdte, fcustdata, ftmphppzne, fediapt214, fapt214dtm, fplanned, ftmsscac, ftmsloadid,
      ftmsresend, cancelled FROM LOADIN WHERE FCONFIRMNM = '${pcConfirmationNumber}'`;

    const lcBatchCondition = truckvo.lcBatch
      ? ` AND FBATCH = '${truckvo.lcBatch}'`
      : '';

    const loadinconfbatch = `BEGIN ${loadinconf}${lcBatchCondition} ORDER BY ID; END`;

    [loadin] = await this.manager().query(loadinconfbatch);

    let [phymst] = await this.manager().query(`BEGIN
      SELECT id,TRIM(fpalletid) as fpalletid,TRIM(fcustpalid) as fcustpalid,fshipstat,fqty,ftrack,frectype
      FROM PHY_MST WHERE FPALLETID = '${truckvo.lcPal}' ORDER BY FPALLETID; END`);
    let data;
    let scrnUI = [];
    truckvo.curOper = TruckReceiveState.MARK_PROCESS_PALLET;
    /**
     * New code added for ecert to get all rf versions
     */
    let RFREQ;
    let RFREQNEW;
    const configCheck = await this.dynamicAttributesService.configCheck(
      this.manager(),
    );
    if (
      configCheck.length > 0 &&
      configCheck[0]?.USE_BARCODE_SCANNING_MAINTENANCE
    ) {
      RFREQNEW = await this.dynamicAttributesService.getRfInfoVersions(
        this.manager(),
        truckvo?.LOADIN?.fcustcode,
        truckvo?.LOADIN?.fconsignor,
      );
      RFREQ = RFREQNEW[0];
    } else {
      [RFREQ] = await this.manager().query(`BEGIN
        SELECT TOP 1 id, fcustcode, fkeylot, fkeyref, fkeytemp, fscanlngth, fprodfrom,  fprodto, fdtefrom, fdteto,
        fwgtfrom, fwgtto,  fboxfrom, fboxto, fscantype,  fcpal, fcpalfrom, fcpalto, fcustlot, fproduct, fcodedate,
        fweight, fbox, fpallet, fcpallet, fqty, flot, fclot, fpalfrom, fpalto,  fqtyfrom, fqtyto, flotfrom, flotto,
        fclotfrom, fclotto, fuse128Bar, fprodvar, fprodvfrom, fprodvto, fltestbnum, fbbdtefrom, fbbdteto, fbbcodedte,
        ffilllot, fdupoutbox, fhndkeywgt, fyywwdcool, fuseasnovr, fprodasn, flotasn, fdateasn, fqtyasn, fedipal, ffirstsscc,
        fcoolcode, fcoolcodefrom, fcoolcodeto, edipalnoqty, ALT_128_CHECK as alt128check, calcProdOrBBDate, CustomerPIDLength,
        AutoFillConsignee,XDockBadPIDToInvCtrl FROM dbo.RFREQ WHERE fcustcode = '${loadin?.fcustcode}' order by fcustcode ASC ;
        END`);
    }
    truckvo.LOADIN = loadin;
    truckvo.RFREQ = RFREQ;
    await this.updateData(fwho, loadin, truckvo);
    if (
      truckvo.lcPal &&
      phymst &&
      phymst.ftrack.slice(0, 7) !== truckvo.lcBatch
    ) {
      let data;
      if (
        truckvo.quickRec &&
        ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
      ) {
        data = { batch: '' };
      } else {
        data = { batch: truckvo.lcBatch };
      }
      await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
      const palField = getFields(TruckReceiveState.MARK_PROCESS_PALLET)
      if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
        palField.maxFieldLen = truckvo.RFREQ.fscanlngth;
      }
      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          curOper: truckvo.curOper,
          errMsg: constant.PALLET_DUPLICATE.trim(),
          infoMsg: '',
          data,
          scrnUI: palField,
        }),
        getOutputFields('palletID'),
        '',
        '',
        truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
          ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
          ? `${constant.F5_EXIT}`
          : truckvo.lineageFreightManagement
            ? `${constant.F5_EXIT}`
            : `${constant.F5_EXIT}~${constant.F8_LABL}`,
      );
    }
    truckvo.navigatePallet = false;
    truckvo.lcPal = '';
    truckvo.lcProd = '';
    let llRffnd = false;
    if (RFREQ) {
      llRffnd = true;
      truckvo.lcKeyLot = RFREQ?.fkeylot?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyEstb = RFREQ?.fltestbnum?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyRef = RFREQ?.fkeyref?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.lcKeyTmp = RFREQ?.fkeytemp?.trim() === 'Y' ? 'Y' : 'N';
      truckvo.llUse128Barcode = RFREQ.fuse128Bar;
      truckvo.lnBarcodeScanLength = RFREQ.fscanlngth;
      truckvo.ywwdcool = RFREQ.fyywwdcool ? RFREQ.fyywwdcool : false;
      truckvo.llASNpal = RFREQ.fedipal ? RFREQ.fedipal : false;
      truckvo.llASNpalNoQty = RFREQ.edipalnoqty ? RFREQ.edipalnoqty : false;
      truckvo.lnCustomerPIDLength = RFREQ.CustomerPIDLength;
      truckvo.plAutoFillConsignee = RFREQ.AutoFillConsignee;
    }
    truckvo.llRrffnd = llRffnd;

    const scanInfo = {
      lc_keylot: truckvo.lcKeyLot,
      lc_keyestb: truckvo.lcKeyEstb,
      lc_keyref: truckvo.lcKeyRef,
      llUse128Barcode: truckvo.llUse128Barcode,
      lnBarcodeScanLength: truckvo.lnBarcodeScanLength,
      ll_yywwdcool: truckvo.ywwdcool,
      ll_ASNpal: truckvo.llASNpal,
      plAlt128Check: truckvo.plAlt128Check,
      ll_ASNpalNoQty: truckvo.llASNpalNoQty,
    };

    if (
      truckvo.quickRec &&
      ['L', 'D', 'S'].includes(truckvo?.quickRec?.fquickrcv)
    ) {
      data = {
        CODE2: truckvo.CODE2,
        RFREQ: truckvo.RFREQ,
        scanInfo,
        RFREQNEW,
        batch: '',
      };
    } else {
      data = {
        CODE2: truckvo.CODE2,
        RFREQ: truckvo.RFREQ,
        scanInfo,
        RFREQNEW,
        batch: truckvo.lcBatch,
      };
    }

    const palField = getFields(TruckReceiveState.MARK_PROCESS_PALLET);
    if (truckvo?.RFREQ && truckvo.RFREQ?.fscanlngth) {
      palField.maxFieldLen = truckvo.RFREQ.fscanlngth;
    }
    scrnUI.push(palField);

    const batchField = getFields(TruckReceiveState.SHOW_PROCESS_BATCH);
    batchField.defaultVal = '';
    batchField.value = '';
    scrnUI.push(batchField);
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        curOper: truckvo.curOper,
        errMsg: '',
        infoMsg: infoMsg,
        data,
        scrnUI,
      }),
      getOutputFields('palletID'),
      '',
      '',
      truckvo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
        ['L', 'D', 'S'].includes(truckvo.quickRec?.fquickrcv)
        ? `${constant.F5_EXIT}`
        : truckvo.lineageFreightManagement
          ? `${constant.F5_EXIT}`
          : `${constant.F5_EXIT}~${constant.F8_LABL}`,
    );
  }

  async updateData(fwho: string, loadin: Loadin, truckvo: TruckReceiveVO) {
    const [rfexpinv] = await this.manager().query(`BEGIN
      SELECT TOP 1 fcustcode,fproduct,fprodgroup,fowner,fsuplrprod,fbatch,flot FROM RFEXPINV
      WHERE FBATCH = '${loadin?.fbatch}' ORDER BY ID;
      END`);
    let fproduct = truckvo.lcProd.trim() ? truckvo.lcProd : rfexpinv?.fproduct;
    const [curCode2] = await this.manager().query(`BEGIN
      SELECT TOP(1) [c2].[FCUSTCODE], [c2].[FPRODGROUP], [c2].[FPRODUCT], [c2].[FOWNER], [c2].[FSUPLRPROD], [c2].[ACTIVE],
      [c2].[FCATCHWGT], [c2].[FNETWGT], [c2].[FDATETYPE], [c2].[FBLASTHRS], [c2].[FTIE], [c2].[FHIGH], [c2].[FBLASTROOM],
      [c2].[FISHPP], [c2].[FBBDTETYPE], [c2].[flength],[c2].[fwidth],[c2].[fheight] FROM [dbo].[CODE2] [c2]
      WHERE (c2.FPRODUCT = '${fproduct}' OR c2.FSUPLRPROD = '${fproduct}')
      AND [c2].[FCUSTCODE] IN ( SELECT DISTINCT FCUSTCODE FROM [dbo].[LOADIN] li
      WHERE [li].[FCONFIRMNM] = '${truckvo.pcConfirmationNumber}')
      ORDER BY [c2].[ACTIVE] DESC, case when [c2].[FPRODUCT] = '${fproduct}' then 0 else 1 end, [c2].[ID];
      END`);

    const [CODE2] = await this.manager().query(`BEGIN
      SELECT id,active,fcustcode,fowner,fproduct,fsuplrprod,fprodgroup,fcatchwgt,fdatetype,fpickdays,ftare,
      fblasthrs,fhold,ftie,fhigh,fblastroom,fbbdtetype,fishpp,fpickcode,flotpatid,fshelflife,fgrosswgt,fnetwgt
      FROM CODE2 WHERE FCUSTCODE = '${curCode2?.FCUSTCODE}' AND
      FPRODGROUP = '${curCode2?.FPRODGROUP}' AND FPRODUCT = '${curCode2?.FPRODUCT}' AND
      FOWNER = '${curCode2?.FOWNER}' AND FSUPLRPROD = '${curCode2?.FSUPLRPROD}';
      END`);
    const carrier = await this.manager().query(
      `SELECT TOP 1 LineageFreightManagement FROM CARRIER WHERE FCUSTCODE = '${loadin?.fcarrier}'`,
    );
    truckvo.lineageFreightManagement =
      carrier && carrier.length > 0
        ? carrier[0].LineageFreightManagement
        : false;
    truckvo.CODE2 = CODE2;
    truckvo.lcCustCode = truckvo.LOADIN?.fcustcode?.trim();
    truckvo.lcLot = rfexpinv?.flot;
    truckvo.llIscatch =
      curCode2?.FCATCHWGT === 'I' || curCode2?.FCATCHWGT === 'B';
    truckvo.lcDteTyp =
      curCode2?.FDATETYPE && curCode2?.FDATETYPE === '1'
        ? 'J'
        : curCode2?.FDATETYPE === '2'
          ? 'C'
          : 'N';
    truckvo.pnWidth = curCode2?.fwidth || 0;
    truckvo.pnHeight = curCode2?.fheight || 0;
    truckvo.pnLength = curCode2?.flength || 0;
    truckvo.lnIntie = curCode2?.FTIE || 0;
    truckvo.lnHigh = curCode2?.FHIGH || 0;
    truckvo.lcBatch = truckvo.LOADIN?.fbatch?.trim();
    truckvo.llOldCatch = truckvo.llIscatch;
    truckvo.lcAcwt = curCode2?.FNETWGT;
    truckvo.lcOldAcwt = truckvo.lcAcwt;
    truckvo.lcOldDteTyp = truckvo.lcDteTyp;
    truckvo.lnBlasthrs = curCode2?.FBLASTHRS === 0 ? 72 : curCode2?.FBLASTHRS;
    truckvo.lnOldTie = truckvo.lnIntie;
    truckvo.lnOldHigh = truckvo.lnHigh;
    truckvo.lcBbdtetype = curCode2?.FBBDTETYPE ? curCode2?.FBBDTETYPE : '';
    truckvo.lcIsBlast = curCode2?.FBLASTROOM?.trim().length > 0 ? 'Y' : 'N';
    truckvo.lcIsBlast1 = curCode2?.FBLASTROOM?.trim().length > 0 ? 'Y' : 'N';
    truckvo.lcIsHPP = curCode2?.FISHPP === true ? 'Y' : 'N';
    truckvo.llIsHPPIn = curCode2?.FISHPP === true;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
  }

  async checkPalletNavigation(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseTruckReceiveDTO>> {
    {
      if (
        truckVo.curOper === TruckReceiveState.MARK_SHOW_NOTES &&
        truckVo.navigatePallet &&
        !body.pono
      ) {
        body.palNo = body && body.palNo ? body.palNo : truckVo.lcPal;
        // you want this if you have edi_pal
        return await this.processPalletIDPrinter(fwho, body, truckVo, constant);
      } else {
        return await this.processPONumberScreen(fwho, truckVo, body, constant);
      }
    }
  }

  async skipPrinterScreen(
    fwho: string,
    truckVo: TruckReceiveVO,
    body: PostRequestTruckReceiveDTO,
    constant: any,
  ) {
    body.sndPal = 'Y';
    body.ti = body.ti ? body.ti : truckVo.lnIntie;
    body.height = body.height ? body.height : truckVo.pnHeight;
    body.width = body.width ? body.width : truckVo.pnWidth;
    body.lngth = body.lngth ? body.lngth : truckVo.pnLength;
    return await this.processSendPallet(fwho, truckVo, body, constant);
  }

  async checkPalletLoaded(
    truckVo: TruckReceiveVO,
    palletID: string,
    constant: any,
  ) {
    const stage_query = `SELECT 1 FROM STAGE WHERE FCUBEDID='${palletID}' AND floaddate IS NOT NULL;`;
    const stage = await this.manager().query(`BEGIN ${stage_query} END;`);
    if (truckVo.quickRec.fquickrcv === 'D' && stage.length) {
      let data = { batch: '' };
      truckVo.curOper = TruckReceiveState.MARK_PROCESS_PALLET;
      let palField = getFields(TruckReceiveState.MARK_PROCESS_PALLET)
      if (truckVo?.RFREQ && truckVo.RFREQ?.fscanlngth) {
        palField.maxFieldLen = truckVo.RFREQ.fscanlngth;
      }
      return new ResponseKeysDTO(
        plainToClass(PostResponseTruckReceiveDTO, {
          curOper: truckVo.curOper,
          errMsg: constant.PALLET_LOADED,
          infoMsg: '',
          data,
          scrnUI: palField,
        }),
        getOutputFields('palletID'),
        '',
        '',
        truckVo.curOper === TruckReceiveState.MARK_PROCESS_PALLET &&
          ['L', 'D', 'S'].includes(truckVo.quickRec?.fquickrcv)
          ? `${constant.F5_EXIT}`
          : truckVo.lineageFreightManagement
            ? `${constant.F5_EXIT}`
            : `${constant.F5_EXIT}~${constant.F8_LABL}`,
      );
    }
    return false;
  }

  async navigateToLoading(
    fwho: string,
    truckvo: TruckReceiveVO,
    warnMsg: string = '',
  ): Promise<any> {
    // truckvo.curOper = TruckReceiveState.MARK_RECEIVING_CLOSE
    const phyMstLData = await this.manager().query(
      `BEGIN select id,fhold,ftrack,fserial,fqty,fmergeid,fpalletid,fstatus,fcustcode,flocation from PHY_MST where FPALLETID = '${truckvo.lcPal}' END;`,
    );

    const lcvo = new LoadingVO();
    if (phyMstLData && phyMstLData.length > 0) {
      lcvo.PHYMST = phyMstLData[0];
    }
    // lcvo.PHYMST = phyMstL;
    lcvo.pcMachineID = truckvo.lcInMachineID ? truckvo.lcInMachineID : '';
    lcvo.lcPal = truckvo.lcPal;
    lcvo.curOper = 'MARK_PROCESS_PALLET';
    lcvo.originator = 'XDOCK-LOADING';
    truckvo.QuickReciverDone = true;
    this.logger.debug(
      {
        'lcvo.lcPal': lcvo.lcPal,
        'lcvo.curOper': lcvo.curOper,
        // 'lcvo.originator': lcvo.originator,// TODO
        QuickReciverDone: truckvo.QuickReciverDone,
      },
      'navigateToLoading > loading flow',
    );
    await this.cacheService.set2Obj(
      fwho,
      TRUCKRECEIVE,
      truckvo,
      OBLOADING,
      lcvo,
    );
    return new ResponseKeysDTO(
      plainToClass(PostResponseTruckReceiveDTO, {
        errMsg: '',
        infoMsg: 'LOADING',
        curOper: truckvo.curOper,
        warnMsg,
      }),
      getOutFieldState(truckvo.curOper),
    );
  }

  async navigateToStagingFromLoading(fwho: string): Promise<any> {
    let loadingvo = new LoadingVO();
    const cacheResults: any = await this.cacheService.getCache(fwho);
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.OBLOADING) {
        loadingvo = obj.OBLOADING as LoadingVO;
      }
    }
    await this.cacheService.delete(fwho, OBLOADING);

    let truckvo = new TruckReceiveVO();
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.TRUCKRECEIVE) {
        truckvo = obj.TRUCKRECEIVE as TruckReceiveVO;
      }
    }

    const doorNumber = truckvo?.fdoornum.toString().padStart(3, '0');
    truckvo.curOper = 'MARK_PALLET_INFO_MSG';
    truckvo.crossDockType = '2';
    truckvo.loadPallet = false;
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    this.logger.debug(
      {
        'truckvo.lcPal': truckvo.lcPal,
        'truckvo.curOper': truckvo.curOper,
        QuickReciverDone: truckvo.QuickReciverDone,
      },
      'processEarlyLoad > loading flow',
    );
    await this.cacheService.set2Obj(
      fwho,
      OBLOADING,
      loadingvo,
      TRUCKRECEIVE,
      truckvo,
    );
    const infoMsg = this.getInfoMessage(truckvo.crossDockType, doorNumber);
    return this.sendInfoMessage(
      fwho,
      truckvo,
      infoMsg,
      // constant.ENTER,
      '-ENTER',
      truckvo.loadPallet,
    );
  }

  async autoReceiveXdock(
    fwho: string,
    truckvo: TruckReceiveVO,
    constant: any,
  ): Promise<any> {
    const fbatch = truckvo.lcBatch;
    const LOADIN = (truckvo.LOADIN as unknown) as Loadin;
    let count = await this.editPAlRepo()
      .createQueryBuilder()
      .where('fbatch = cast(:fbatch as char(7))', { fbatch })
      .getCount();
    let result = await this.phymstRepo()
      .createQueryBuilder('pm')
      .select([
        'TRIM(pm.fpalletid) as fpalletid',
        'TRIM(pm.fcustpalid) as fcustpalid',
        'pm.fqty',
        'pm.ftrack',
        'pm.fserial',
        'pt.frectype',
        'pt.fbatch',
        'pt.fsequence',
      ])
      .innerJoin(
        PhyTrn,
        'pt',
        'pm.FTRACK = pt.FTRACK AND pm.FSERIAL = pt.FSERIAL',
      )
      .innerJoin(EdiPal, 'ep', 'ep.FPALLETID = pm.FPALLETID')
      .where("pt.FRECTYPE = 'X' AND pt.FBATCH = :fbatch", { fbatch })
      .getMany();
    if (result && count && result.length === count) {
      let INV_TRN = await this.facilityService
        .getConnection()
        .getRepository(InvTrn)
        .createQueryBuilder('it')
        .where('it.fbatch = cast(:fbatch as char(7))', { fbatch })
        .getOne();
      const PHY_MST_ARR = await this.facilityService
        .getConnection()
        .getRepository(PhyMst)
        .createQueryBuilder('pm')
        .where('pm.ftrack LIKE cast(:ftrack as char(10))', {
          ftrack: `${fbatch}%`,
        })
        .getMany();
      const PHY_TRN_ARR = await this.facilityService
        .getConnection()
        .getRepository(PhyTrn)
        .createQueryBuilder('pt')
        .where('pt.fbatch = cast(:fbatch as char(7))', { fbatch })
        .getMany();
      const INV_MST_ARR = await this.facilityService
        .getConnection()
        .getRepository(InvMst)
        .createQueryBuilder('im')
        .where('im.fbatch = cast(:fbatch as char(7))', { fbatch })
        .getMany();

      for (const INV_MST of INV_MST_ARR) {
        if (INV_MST && INV_MST.fbatch === fbatch) {
          let llLothasHPP = false;
          INV_TRN = await this.facilityService
            .getConnection()
            .getRepository(InvTrn)
            .createQueryBuilder('it')
            .where('it.fbatch = cast(:fbatch as char(7))', { fbatch })
            .andWhere('it.fsequence = cast(:fsequence as char(3))', {
              fsequence: INV_MST?.fsequence,
            })
            .getOne();
          if (INV_TRN) {
            let lnpals = 0;
            let lnqty = 0;

            // * We're Ok To Update The INV_MST and INV_TRN Records
            const PHY_MST_ARR_TEMP = await this.facilityService
              .getConnection()
              .getRepository(PhyMst)
              .createQueryBuilder('pm')
              .where('pm.ftrack = cast(:ftrack as char(10))', {
                ftrack: `${INV_MST?.fbatch}${INV_MST?.fsequence}`,
              })
              .getMany();
            for (const PHY_MST of PHY_MST_ARR_TEMP) {
              if (PHY_MST) {
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
                  if (!(PHY_TRN?.fqty === 0 && PHY_MST.fqty === 0)) {
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
            // All Updates To PHY_MST & PHY_DET Complete - Do The Updates To The INV_MSTs

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
            const CODE2 = await this.facilityService
              .getConnection()
              .getRepository(Code2)
              .createQueryBuilder('c2')
              .where('c2.fcustcode = cast(:fcustcode as char(10))', {
                fcustcode: INV_MST?.fcustcode,
              })
              .andWhere('c2.fprodgroup = cast(:fprodgroup as char(5))', {
                fprodgroup: INV_MST?.fprodgroup,
              })
              .andWhere('c2.fproduct = cast(:fproduct as char(50))', {
                fproduct: INV_MST?.fproduct,
              })
              .andWhere('c2.fowner = cast(:fowner as char(10))', {
                fowner: INV_MST?.fowner,
              })
              .andWhere('c2.fsuplrprod = cast(:fsuplrprod as char(16))', {
                fsuplrprod: INV_MST?.fsuplrprod,
              })
              .getOne();
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
              // Get Total Net Weight
              if (lciscwgt === 'Y') {
                const PHY_DET = await this.facilityService
                  .getConnection()
                  .getRepository(PhyDet)
                  .createQueryBuilder('pd')
                  .where('pd.fbatch = cast(:fbatch as char(7))', {
                    fbatch: INV_MST?.fbatch,
                  })
                  .andWhere('pd.fsequence = cast(:fsequence as char(3))', {
                    fsequence: INV_MST?.fsequence,
                  })
                  .getMany();
                if (PHY_DET && PHY_DET.length > 0) {
                  const phyDetLnWgt = await this.facilityService
                    .getConnection()
                    .getRepository(PhyDet)
                    .createQueryBuilder('pd')
                    .select('SUM(pd.fnetwgt) as lnWgt2')
                    .where('pd.fbatch = cast(:fbatch as char(7))', {
                      fbatch: INV_MST?.fbatch,
                    })
                    .andWhere('pd.fsequence = cast(:fsequence as char(3))', {
                      fsequence: INV_MST?.fsequence,
                    })
                    .getRawOne();
                  lnWgt2 = phyDetLnWgt && phyDetLnWgt.lnWgt2;
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

            let updateInvMstInvTrn = '';
            updateInvMstInvTrn = `UPDATE INV_TRN SET FGROSSWGT = ${lnWgt1}, FNETWGT = ${lnWgt2} WHERE  FBATCH = '${INV_MST.fbatch}' AND FSEQUENCE = '${INV_MST.fsequence}';`;
            updateInvMstInvTrn = `${updateInvMstInvTrn} UPDATE INV_MST SET fgrosswgt = ${lnWgt1}, fnetwgt = ${lnWgt2}, fo_qty = ${lnqty}, fo_groswgt = ${lnWgt1}, fo_netwgt = ${lnWgt2}, fo_cube = ${INV_MST.fcube}, fo_pal = ${lnpals} WHERE id =  ${INV_MST.id} ;`;
            await this.manager().query(`BEGIN ${updateInvMstInvTrn}; END;`);
          }
        }
      }

      const params1 = {
        gcUser: fwho,
        inBatch: truckvo.lcBatch,
        result: '',
        outConscrossmessage: '',
        variancecheckonly: 0,
      };
      const result1 = await this.storedProceduresNewService.getAutoInReceive(
        params1,
      );
      this.logger.debug(
        result1,
        'autoReceiveXdock > Executing SP getAutoInReceive',
      );
      if (result1.returnValue === 0) {
        const params2 = {
          gcUser: fwho,
          inBatch: truckvo.lcBatch,
          inQ1: 'N',
          inQ2: 'N',
          inQ3: 'N',
          outConscrossmessage: '',
        };
        const result2 = await this.storedProceduresNewService.getInReceive(
          params2,
        );
        this.logger.debug(
          result2,
          'autoReceiveXdock > Executing SP getInReceive',
        );
        const loadinUpdateRes = await this.facilityService
          .getConnection()
          .getRepository(Loadin)
          .createQueryBuilder('li')
          .where('li.FCONFIRMNM = cast(:fconfirmnm as char(10))', {
            fconfirmnm: LOADIN?.fconfirmnm,
          })
          .andWhere('li.FSHIPSTAT != cast(:fshipstat as char(1))', {
            fshipstat: 'Y',
          })
          .getRawMany();
        if (loadinUpdateRes?.length === 0) {
          await this.facilityService
            .getConnection()
            .getRepository(Iconfirm)
            .createQueryBuilder()
            .update(Iconfirm)
            .set({ fshipped: 'Y' })
            .where('fmbol = cast(:fmbol as char(10))', {
              fmbol: LOADIN?.fconfirmnm,
            })
            .execute();
        }
      }
    }
    truckvo.lcPal = '';
    await this.cacheService.setcache(fwho, TRUCKRECEIVE, truckvo);
    return await this.processNavigateToPalletIdScreen(
      fwho,
      truckvo.LOADIN?.fconfirmnm,
      truckvo,
      constant,
    );
  }
}
