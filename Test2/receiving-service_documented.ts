/*
Date: 27/10/2025
User: Agentic_AI_System_Documenter
Code Language: TypeScript
// This service handles receiving operations within a logistics management system, processing inventory updates, and managing incoming shipments.
import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { EntityManager, Repository } from 'typeorm';
import { plainToClass } from 'class-transformer';
import { Code2 } from 'entities/Code2';
import { EdiPal } from 'entities/EdiPal';
import { PhyMst } from 'entities/PhyMst';
import { InvMst } from 'entities/InvMst';
import { ResponseKeysDTO } from 'shared/dtos/responsekeys.dto';
import { PostRequestReceivingDTO } from './_dtos/post.request.dto';
import { PostResponseReceivingDTO } from './_dtos/post.response.dto';
import { ReceivingState } from './receiving.enum';
import { CustomLogger } from 'modules/logger/custom.logger';
import { ConnectRFCacheService } from 'modules/cache/cache.service';
import { FacilityService } from 'modules/database/facility/facility.service';
import { GlobalisationService } from 'modules/globalisation/service';
import { FormBuilderService } from 'modules/formbuilder/service';
import { ReceivingVO } from './vos/receivingvo';
@Injectable()
export class ReceivingService {
  constructor(
    @InjectRepository(PhyMst)
    private phymstRepo: Repository<PhyMst>,
    @InjectRepository(EdiPal)
    private editPAlRepo: Repository<EdiPal>,
    @InjectRepository(Code2)
    private code2Repo: Repository<Code2>,
    @InjectRepository(InvMst)
    private invMstRepo: Repository<InvMst>,
    @InjectEntityManager()
    private manager: EntityManager,
    private eventEmitter: EventEmitter2,
    private httpService: HttpService,
    private readonly cacheService: ConnectRFCacheService,
    private facilityService: FacilityService,
    private globalizationService: GlobalisationService,
    private logger: CustomLogger,
    private formBuilderService: FormBuilderService,
  ) {
    this.facilityService.injectRepos(this);
  }
  /**
   * Executes receiving operations based on input signals and current operational state.
   * @param fwho - The identifier for the user or process initiating the request.
   * @param pcMachineID - The ID of the machine processing the receiving operation.
   * @param body - The request body containing input signals and data.
   * @returns A promise that resolves to a ResponseKeysDTO containing the result of the operation.
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
    const { constants: constant } = await this.formBuilderService.fieldsByScreen(this.manager, 'INBOUNDRECEIVING', cacheResults as string);
    // Footer buttons for the UI based on constants received from form builder.
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
    // Attempt to retrieve cache results related to receiving.
    if (cacheResults && cacheResults !== '') {
      const obj = JSON.parse(cacheResults as string);
      if (obj && obj.RECEIVING) {
        recvo = obj.RECEIVING as ReceivingVO;
      }
    }
    // Validate machine ID and set receiving data.
    if (
      pcMachineID &&
      pcMachineID.length > 0 &&
      (recvo.pcMachineID === '' || recvo.pcMachineID === undefined)
    ) {
      recvo.pcMachineID = pcMachineID;
    }
    recvo.fwho = fwho;
    // Start time tracking for performance logging.
    const startTime = new Date();
    this.logger.debug(
      {
        fwho,
        startTime: `${new Date().toISOString()}`,
        payLoad: body,
      },
      `Execute > Receiving  > ${recvo.curOper}`,
    );
    let result;
    // Processing based on input signals and current operation.
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
        // A series of case checks to process receiving based on the current operation state.
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
          case ReceivingState.MARK_SEND_PALLET: {
            result = this.processSendPallet(fwho, body, recvo, constant);
            break;
          }
          case ReceivingState.MARK_PROCESS_PALLET_TYPE: {
            result = this.processPalletType(fwho, body, recvo, constant);
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
      // Performance logging end.
      this.logger.debug(
        `receiving --> executeReceiving | End time ${new Date().toISOString()} |  ${fwho} | ${recvo.curOper}`,
        ReceivingService.name,
      );
      this.logger.debug(
        `receiving --> executeReceiving | Elapsed time ${new Date().getTime() - startTime.getTime()} ms | OUT Time ${new Date().toISOString()} |  ${fwho} | ${
          recvo.curOper
        }`,
        ReceivingService.name,
      );
    }
    return result;
  }
  /**
   * Processes the exit operation for receiving.
   * @param fwho - The identifier for the user or process initiating the request.
   * @param recvo - The current receiving state object.
   * @param constant - Constants for UI elements.
   * @returns A promise that resolves to a ResponseKeysDTO containing the result of the exit operation.
   */
  async processExit(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    // Exit processing logic...
  }
  /**
   * Processes batch operations for receiving.
   * @param fwho - The identifier for the user or process initiating the request.
   * @param body - The request body containing input signals and data.
   * @param recvo - The current receiving state object.
   * @param constant - Constants for UI elements.
   * @returns A promise that resolves to a ResponseKeysDTO containing the result of the batch operation.
   */
  async processBatch(
    fwho: string,
    body: PostRequestReceivingDTO,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    // Batch processing logic would go here...
  }
  /**
   * Processes F4 Lot operations for receiving.
   * @param fwho - The identifier for the user or process initiating the request.
   * @param recvo - The current receiving state object.
   * @param constant - Constants for UI elements.
   * @returns A promise that resolves to a ResponseKeysDTO containing the result of the F4 Lot operation.
   */
  async processF4Lot(
    fwho: string,
    recvo: ReceivingVO,
    constant: any,
  ): Promise<ResponseKeysDTO<PostResponseReceivingDTO>> {
    // F4 Lot processing logic would go here...
  }
  // Additional helper methods for specific functionalities would go here...
}