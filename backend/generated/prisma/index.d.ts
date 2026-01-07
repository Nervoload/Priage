
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Hospital
 * 
 */
export type Hospital = $Result.DefaultSelection<Prisma.$HospitalPayload>
/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Patient
 * 
 */
export type Patient = $Result.DefaultSelection<Prisma.$PatientPayload>
/**
 * Model Encounter
 * 
 */
export type Encounter = $Result.DefaultSelection<Prisma.$EncounterPayload>
/**
 * Model TriageNote
 * 
 */
export type TriageNote = $Result.DefaultSelection<Prisma.$TriageNotePayload>
/**
 * Model Message
 * 
 */
export type Message = $Result.DefaultSelection<Prisma.$MessagePayload>

/**
 * Enums
 */
export namespace $Enums {
  export const EncounterStatus: {
  PRE_TRIAGE: 'PRE_TRIAGE',
  ARRIVED: 'ARRIVED',
  TRIAGE: 'TRIAGE',
  WAITING: 'WAITING',
  COMPLETE: 'COMPLETE',
  CANCELLED: 'CANCELLED'
};

export type EncounterStatus = (typeof EncounterStatus)[keyof typeof EncounterStatus]


export const Role: {
  ADMIN: 'ADMIN',
  MEDICAL_STAFF: 'MEDICAL_STAFF',
  SUPPORT_STAFF: 'SUPPORT_STAFF'
};

export type Role = (typeof Role)[keyof typeof Role]


export const MessageAuthor: {
  PATIENT: 'PATIENT',
  STAFF: 'STAFF'
};

export type MessageAuthor = (typeof MessageAuthor)[keyof typeof MessageAuthor]

}

export type EncounterStatus = $Enums.EncounterStatus

export const EncounterStatus: typeof $Enums.EncounterStatus

export type Role = $Enums.Role

export const Role: typeof $Enums.Role

export type MessageAuthor = $Enums.MessageAuthor

export const MessageAuthor: typeof $Enums.MessageAuthor

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Hospitals
 * const hospitals = await prisma.hospital.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Hospitals
   * const hospitals = await prisma.hospital.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.hospital`: Exposes CRUD operations for the **Hospital** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Hospitals
    * const hospitals = await prisma.hospital.findMany()
    * ```
    */
  get hospital(): Prisma.HospitalDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.patient`: Exposes CRUD operations for the **Patient** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Patients
    * const patients = await prisma.patient.findMany()
    * ```
    */
  get patient(): Prisma.PatientDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.encounter`: Exposes CRUD operations for the **Encounter** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Encounters
    * const encounters = await prisma.encounter.findMany()
    * ```
    */
  get encounter(): Prisma.EncounterDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.triageNote`: Exposes CRUD operations for the **TriageNote** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TriageNotes
    * const triageNotes = await prisma.triageNote.findMany()
    * ```
    */
  get triageNote(): Prisma.TriageNoteDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.message`: Exposes CRUD operations for the **Message** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Messages
    * const messages = await prisma.message.findMany()
    * ```
    */
  get message(): Prisma.MessageDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.2.0
   * Query Engine version: 0c8ef2ce45c83248ab3df073180d5eda9e8be7a3
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Hospital: 'Hospital',
    User: 'User',
    Patient: 'Patient',
    Encounter: 'Encounter',
    TriageNote: 'TriageNote',
    Message: 'Message'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "hospital" | "user" | "patient" | "encounter" | "triageNote" | "message"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Hospital: {
        payload: Prisma.$HospitalPayload<ExtArgs>
        fields: Prisma.HospitalFieldRefs
        operations: {
          findUnique: {
            args: Prisma.HospitalFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.HospitalFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>
          }
          findFirst: {
            args: Prisma.HospitalFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.HospitalFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>
          }
          findMany: {
            args: Prisma.HospitalFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>[]
          }
          create: {
            args: Prisma.HospitalCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>
          }
          createMany: {
            args: Prisma.HospitalCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.HospitalCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>[]
          }
          delete: {
            args: Prisma.HospitalDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>
          }
          update: {
            args: Prisma.HospitalUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>
          }
          deleteMany: {
            args: Prisma.HospitalDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.HospitalUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.HospitalUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>[]
          }
          upsert: {
            args: Prisma.HospitalUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HospitalPayload>
          }
          aggregate: {
            args: Prisma.HospitalAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateHospital>
          }
          groupBy: {
            args: Prisma.HospitalGroupByArgs<ExtArgs>
            result: $Utils.Optional<HospitalGroupByOutputType>[]
          }
          count: {
            args: Prisma.HospitalCountArgs<ExtArgs>
            result: $Utils.Optional<HospitalCountAggregateOutputType> | number
          }
        }
      }
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Patient: {
        payload: Prisma.$PatientPayload<ExtArgs>
        fields: Prisma.PatientFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PatientFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PatientFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>
          }
          findFirst: {
            args: Prisma.PatientFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PatientFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>
          }
          findMany: {
            args: Prisma.PatientFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>[]
          }
          create: {
            args: Prisma.PatientCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>
          }
          createMany: {
            args: Prisma.PatientCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PatientCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>[]
          }
          delete: {
            args: Prisma.PatientDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>
          }
          update: {
            args: Prisma.PatientUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>
          }
          deleteMany: {
            args: Prisma.PatientDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PatientUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PatientUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>[]
          }
          upsert: {
            args: Prisma.PatientUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PatientPayload>
          }
          aggregate: {
            args: Prisma.PatientAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePatient>
          }
          groupBy: {
            args: Prisma.PatientGroupByArgs<ExtArgs>
            result: $Utils.Optional<PatientGroupByOutputType>[]
          }
          count: {
            args: Prisma.PatientCountArgs<ExtArgs>
            result: $Utils.Optional<PatientCountAggregateOutputType> | number
          }
        }
      }
      Encounter: {
        payload: Prisma.$EncounterPayload<ExtArgs>
        fields: Prisma.EncounterFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EncounterFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EncounterFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>
          }
          findFirst: {
            args: Prisma.EncounterFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EncounterFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>
          }
          findMany: {
            args: Prisma.EncounterFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>[]
          }
          create: {
            args: Prisma.EncounterCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>
          }
          createMany: {
            args: Prisma.EncounterCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EncounterCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>[]
          }
          delete: {
            args: Prisma.EncounterDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>
          }
          update: {
            args: Prisma.EncounterUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>
          }
          deleteMany: {
            args: Prisma.EncounterDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EncounterUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EncounterUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>[]
          }
          upsert: {
            args: Prisma.EncounterUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EncounterPayload>
          }
          aggregate: {
            args: Prisma.EncounterAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEncounter>
          }
          groupBy: {
            args: Prisma.EncounterGroupByArgs<ExtArgs>
            result: $Utils.Optional<EncounterGroupByOutputType>[]
          }
          count: {
            args: Prisma.EncounterCountArgs<ExtArgs>
            result: $Utils.Optional<EncounterCountAggregateOutputType> | number
          }
        }
      }
      TriageNote: {
        payload: Prisma.$TriageNotePayload<ExtArgs>
        fields: Prisma.TriageNoteFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TriageNoteFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TriageNoteFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>
          }
          findFirst: {
            args: Prisma.TriageNoteFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TriageNoteFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>
          }
          findMany: {
            args: Prisma.TriageNoteFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>[]
          }
          create: {
            args: Prisma.TriageNoteCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>
          }
          createMany: {
            args: Prisma.TriageNoteCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TriageNoteCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>[]
          }
          delete: {
            args: Prisma.TriageNoteDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>
          }
          update: {
            args: Prisma.TriageNoteUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>
          }
          deleteMany: {
            args: Prisma.TriageNoteDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TriageNoteUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TriageNoteUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>[]
          }
          upsert: {
            args: Prisma.TriageNoteUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TriageNotePayload>
          }
          aggregate: {
            args: Prisma.TriageNoteAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTriageNote>
          }
          groupBy: {
            args: Prisma.TriageNoteGroupByArgs<ExtArgs>
            result: $Utils.Optional<TriageNoteGroupByOutputType>[]
          }
          count: {
            args: Prisma.TriageNoteCountArgs<ExtArgs>
            result: $Utils.Optional<TriageNoteCountAggregateOutputType> | number
          }
        }
      }
      Message: {
        payload: Prisma.$MessagePayload<ExtArgs>
        fields: Prisma.MessageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MessageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MessageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          findFirst: {
            args: Prisma.MessageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MessageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          findMany: {
            args: Prisma.MessageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          create: {
            args: Prisma.MessageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          createMany: {
            args: Prisma.MessageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MessageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          delete: {
            args: Prisma.MessageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          update: {
            args: Prisma.MessageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          deleteMany: {
            args: Prisma.MessageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MessageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MessageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          upsert: {
            args: Prisma.MessageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          aggregate: {
            args: Prisma.MessageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMessage>
          }
          groupBy: {
            args: Prisma.MessageGroupByArgs<ExtArgs>
            result: $Utils.Optional<MessageGroupByOutputType>[]
          }
          count: {
            args: Prisma.MessageCountArgs<ExtArgs>
            result: $Utils.Optional<MessageCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    hospital?: HospitalOmit
    user?: UserOmit
    patient?: PatientOmit
    encounter?: EncounterOmit
    triageNote?: TriageNoteOmit
    message?: MessageOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type HospitalCountOutputType
   */

  export type HospitalCountOutputType = {
    encounters: number
    users: number
  }

  export type HospitalCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    encounters?: boolean | HospitalCountOutputTypeCountEncountersArgs
    users?: boolean | HospitalCountOutputTypeCountUsersArgs
  }

  // Custom InputTypes
  /**
   * HospitalCountOutputType without action
   */
  export type HospitalCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HospitalCountOutputType
     */
    select?: HospitalCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * HospitalCountOutputType without action
   */
  export type HospitalCountOutputTypeCountEncountersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EncounterWhereInput
  }

  /**
   * HospitalCountOutputType without action
   */
  export type HospitalCountOutputTypeCountUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
  }


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    triageNotes: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    triageNotes?: boolean | UserCountOutputTypeCountTriageNotesArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountTriageNotesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TriageNoteWhereInput
  }


  /**
   * Count Type PatientCountOutputType
   */

  export type PatientCountOutputType = {
    encounters: number
  }

  export type PatientCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    encounters?: boolean | PatientCountOutputTypeCountEncountersArgs
  }

  // Custom InputTypes
  /**
   * PatientCountOutputType without action
   */
  export type PatientCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PatientCountOutputType
     */
    select?: PatientCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PatientCountOutputType without action
   */
  export type PatientCountOutputTypeCountEncountersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EncounterWhereInput
  }


  /**
   * Count Type EncounterCountOutputType
   */

  export type EncounterCountOutputType = {
    triageNotes: number
    messages: number
  }

  export type EncounterCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    triageNotes?: boolean | EncounterCountOutputTypeCountTriageNotesArgs
    messages?: boolean | EncounterCountOutputTypeCountMessagesArgs
  }

  // Custom InputTypes
  /**
   * EncounterCountOutputType without action
   */
  export type EncounterCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EncounterCountOutputType
     */
    select?: EncounterCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * EncounterCountOutputType without action
   */
  export type EncounterCountOutputTypeCountTriageNotesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TriageNoteWhereInput
  }

  /**
   * EncounterCountOutputType without action
   */
  export type EncounterCountOutputTypeCountMessagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MessageWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Hospital
   */

  export type AggregateHospital = {
    _count: HospitalCountAggregateOutputType | null
    _avg: HospitalAvgAggregateOutputType | null
    _sum: HospitalSumAggregateOutputType | null
    _min: HospitalMinAggregateOutputType | null
    _max: HospitalMaxAggregateOutputType | null
  }

  export type HospitalAvgAggregateOutputType = {
    id: number | null
  }

  export type HospitalSumAggregateOutputType = {
    id: number | null
  }

  export type HospitalMinAggregateOutputType = {
    id: number | null
    name: string | null
    slug: string | null
  }

  export type HospitalMaxAggregateOutputType = {
    id: number | null
    name: string | null
    slug: string | null
  }

  export type HospitalCountAggregateOutputType = {
    id: number
    name: number
    slug: number
    _all: number
  }


  export type HospitalAvgAggregateInputType = {
    id?: true
  }

  export type HospitalSumAggregateInputType = {
    id?: true
  }

  export type HospitalMinAggregateInputType = {
    id?: true
    name?: true
    slug?: true
  }

  export type HospitalMaxAggregateInputType = {
    id?: true
    name?: true
    slug?: true
  }

  export type HospitalCountAggregateInputType = {
    id?: true
    name?: true
    slug?: true
    _all?: true
  }

  export type HospitalAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Hospital to aggregate.
     */
    where?: HospitalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Hospitals to fetch.
     */
    orderBy?: HospitalOrderByWithRelationInput | HospitalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: HospitalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Hospitals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Hospitals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Hospitals
    **/
    _count?: true | HospitalCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: HospitalAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: HospitalSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: HospitalMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: HospitalMaxAggregateInputType
  }

  export type GetHospitalAggregateType<T extends HospitalAggregateArgs> = {
        [P in keyof T & keyof AggregateHospital]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateHospital[P]>
      : GetScalarType<T[P], AggregateHospital[P]>
  }




  export type HospitalGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: HospitalWhereInput
    orderBy?: HospitalOrderByWithAggregationInput | HospitalOrderByWithAggregationInput[]
    by: HospitalScalarFieldEnum[] | HospitalScalarFieldEnum
    having?: HospitalScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: HospitalCountAggregateInputType | true
    _avg?: HospitalAvgAggregateInputType
    _sum?: HospitalSumAggregateInputType
    _min?: HospitalMinAggregateInputType
    _max?: HospitalMaxAggregateInputType
  }

  export type HospitalGroupByOutputType = {
    id: number
    name: string
    slug: string
    _count: HospitalCountAggregateOutputType | null
    _avg: HospitalAvgAggregateOutputType | null
    _sum: HospitalSumAggregateOutputType | null
    _min: HospitalMinAggregateOutputType | null
    _max: HospitalMaxAggregateOutputType | null
  }

  type GetHospitalGroupByPayload<T extends HospitalGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<HospitalGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof HospitalGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], HospitalGroupByOutputType[P]>
            : GetScalarType<T[P], HospitalGroupByOutputType[P]>
        }
      >
    >


  export type HospitalSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    slug?: boolean
    encounters?: boolean | Hospital$encountersArgs<ExtArgs>
    users?: boolean | Hospital$usersArgs<ExtArgs>
    _count?: boolean | HospitalCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["hospital"]>

  export type HospitalSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    slug?: boolean
  }, ExtArgs["result"]["hospital"]>

  export type HospitalSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    slug?: boolean
  }, ExtArgs["result"]["hospital"]>

  export type HospitalSelectScalar = {
    id?: boolean
    name?: boolean
    slug?: boolean
  }

  export type HospitalOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "slug", ExtArgs["result"]["hospital"]>
  export type HospitalInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    encounters?: boolean | Hospital$encountersArgs<ExtArgs>
    users?: boolean | Hospital$usersArgs<ExtArgs>
    _count?: boolean | HospitalCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type HospitalIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type HospitalIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $HospitalPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Hospital"
    objects: {
      encounters: Prisma.$EncounterPayload<ExtArgs>[]
      users: Prisma.$UserPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      name: string
      slug: string
    }, ExtArgs["result"]["hospital"]>
    composites: {}
  }

  type HospitalGetPayload<S extends boolean | null | undefined | HospitalDefaultArgs> = $Result.GetResult<Prisma.$HospitalPayload, S>

  type HospitalCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<HospitalFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: HospitalCountAggregateInputType | true
    }

  export interface HospitalDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Hospital'], meta: { name: 'Hospital' } }
    /**
     * Find zero or one Hospital that matches the filter.
     * @param {HospitalFindUniqueArgs} args - Arguments to find a Hospital
     * @example
     * // Get one Hospital
     * const hospital = await prisma.hospital.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends HospitalFindUniqueArgs>(args: SelectSubset<T, HospitalFindUniqueArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Hospital that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {HospitalFindUniqueOrThrowArgs} args - Arguments to find a Hospital
     * @example
     * // Get one Hospital
     * const hospital = await prisma.hospital.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends HospitalFindUniqueOrThrowArgs>(args: SelectSubset<T, HospitalFindUniqueOrThrowArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Hospital that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HospitalFindFirstArgs} args - Arguments to find a Hospital
     * @example
     * // Get one Hospital
     * const hospital = await prisma.hospital.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends HospitalFindFirstArgs>(args?: SelectSubset<T, HospitalFindFirstArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Hospital that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HospitalFindFirstOrThrowArgs} args - Arguments to find a Hospital
     * @example
     * // Get one Hospital
     * const hospital = await prisma.hospital.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends HospitalFindFirstOrThrowArgs>(args?: SelectSubset<T, HospitalFindFirstOrThrowArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Hospitals that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HospitalFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Hospitals
     * const hospitals = await prisma.hospital.findMany()
     * 
     * // Get first 10 Hospitals
     * const hospitals = await prisma.hospital.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const hospitalWithIdOnly = await prisma.hospital.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends HospitalFindManyArgs>(args?: SelectSubset<T, HospitalFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Hospital.
     * @param {HospitalCreateArgs} args - Arguments to create a Hospital.
     * @example
     * // Create one Hospital
     * const Hospital = await prisma.hospital.create({
     *   data: {
     *     // ... data to create a Hospital
     *   }
     * })
     * 
     */
    create<T extends HospitalCreateArgs>(args: SelectSubset<T, HospitalCreateArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Hospitals.
     * @param {HospitalCreateManyArgs} args - Arguments to create many Hospitals.
     * @example
     * // Create many Hospitals
     * const hospital = await prisma.hospital.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends HospitalCreateManyArgs>(args?: SelectSubset<T, HospitalCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Hospitals and returns the data saved in the database.
     * @param {HospitalCreateManyAndReturnArgs} args - Arguments to create many Hospitals.
     * @example
     * // Create many Hospitals
     * const hospital = await prisma.hospital.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Hospitals and only return the `id`
     * const hospitalWithIdOnly = await prisma.hospital.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends HospitalCreateManyAndReturnArgs>(args?: SelectSubset<T, HospitalCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Hospital.
     * @param {HospitalDeleteArgs} args - Arguments to delete one Hospital.
     * @example
     * // Delete one Hospital
     * const Hospital = await prisma.hospital.delete({
     *   where: {
     *     // ... filter to delete one Hospital
     *   }
     * })
     * 
     */
    delete<T extends HospitalDeleteArgs>(args: SelectSubset<T, HospitalDeleteArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Hospital.
     * @param {HospitalUpdateArgs} args - Arguments to update one Hospital.
     * @example
     * // Update one Hospital
     * const hospital = await prisma.hospital.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends HospitalUpdateArgs>(args: SelectSubset<T, HospitalUpdateArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Hospitals.
     * @param {HospitalDeleteManyArgs} args - Arguments to filter Hospitals to delete.
     * @example
     * // Delete a few Hospitals
     * const { count } = await prisma.hospital.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends HospitalDeleteManyArgs>(args?: SelectSubset<T, HospitalDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Hospitals.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HospitalUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Hospitals
     * const hospital = await prisma.hospital.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends HospitalUpdateManyArgs>(args: SelectSubset<T, HospitalUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Hospitals and returns the data updated in the database.
     * @param {HospitalUpdateManyAndReturnArgs} args - Arguments to update many Hospitals.
     * @example
     * // Update many Hospitals
     * const hospital = await prisma.hospital.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Hospitals and only return the `id`
     * const hospitalWithIdOnly = await prisma.hospital.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends HospitalUpdateManyAndReturnArgs>(args: SelectSubset<T, HospitalUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Hospital.
     * @param {HospitalUpsertArgs} args - Arguments to update or create a Hospital.
     * @example
     * // Update or create a Hospital
     * const hospital = await prisma.hospital.upsert({
     *   create: {
     *     // ... data to create a Hospital
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Hospital we want to update
     *   }
     * })
     */
    upsert<T extends HospitalUpsertArgs>(args: SelectSubset<T, HospitalUpsertArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Hospitals.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HospitalCountArgs} args - Arguments to filter Hospitals to count.
     * @example
     * // Count the number of Hospitals
     * const count = await prisma.hospital.count({
     *   where: {
     *     // ... the filter for the Hospitals we want to count
     *   }
     * })
    **/
    count<T extends HospitalCountArgs>(
      args?: Subset<T, HospitalCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], HospitalCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Hospital.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HospitalAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends HospitalAggregateArgs>(args: Subset<T, HospitalAggregateArgs>): Prisma.PrismaPromise<GetHospitalAggregateType<T>>

    /**
     * Group by Hospital.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HospitalGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends HospitalGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: HospitalGroupByArgs['orderBy'] }
        : { orderBy?: HospitalGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, HospitalGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHospitalGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Hospital model
   */
  readonly fields: HospitalFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Hospital.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__HospitalClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    encounters<T extends Hospital$encountersArgs<ExtArgs> = {}>(args?: Subset<T, Hospital$encountersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    users<T extends Hospital$usersArgs<ExtArgs> = {}>(args?: Subset<T, Hospital$usersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Hospital model
   */
  interface HospitalFieldRefs {
    readonly id: FieldRef<"Hospital", 'Int'>
    readonly name: FieldRef<"Hospital", 'String'>
    readonly slug: FieldRef<"Hospital", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Hospital findUnique
   */
  export type HospitalFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * Filter, which Hospital to fetch.
     */
    where: HospitalWhereUniqueInput
  }

  /**
   * Hospital findUniqueOrThrow
   */
  export type HospitalFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * Filter, which Hospital to fetch.
     */
    where: HospitalWhereUniqueInput
  }

  /**
   * Hospital findFirst
   */
  export type HospitalFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * Filter, which Hospital to fetch.
     */
    where?: HospitalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Hospitals to fetch.
     */
    orderBy?: HospitalOrderByWithRelationInput | HospitalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Hospitals.
     */
    cursor?: HospitalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Hospitals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Hospitals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Hospitals.
     */
    distinct?: HospitalScalarFieldEnum | HospitalScalarFieldEnum[]
  }

  /**
   * Hospital findFirstOrThrow
   */
  export type HospitalFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * Filter, which Hospital to fetch.
     */
    where?: HospitalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Hospitals to fetch.
     */
    orderBy?: HospitalOrderByWithRelationInput | HospitalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Hospitals.
     */
    cursor?: HospitalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Hospitals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Hospitals.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Hospitals.
     */
    distinct?: HospitalScalarFieldEnum | HospitalScalarFieldEnum[]
  }

  /**
   * Hospital findMany
   */
  export type HospitalFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * Filter, which Hospitals to fetch.
     */
    where?: HospitalWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Hospitals to fetch.
     */
    orderBy?: HospitalOrderByWithRelationInput | HospitalOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Hospitals.
     */
    cursor?: HospitalWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Hospitals from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Hospitals.
     */
    skip?: number
    distinct?: HospitalScalarFieldEnum | HospitalScalarFieldEnum[]
  }

  /**
   * Hospital create
   */
  export type HospitalCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * The data needed to create a Hospital.
     */
    data: XOR<HospitalCreateInput, HospitalUncheckedCreateInput>
  }

  /**
   * Hospital createMany
   */
  export type HospitalCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Hospitals.
     */
    data: HospitalCreateManyInput | HospitalCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Hospital createManyAndReturn
   */
  export type HospitalCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * The data used to create many Hospitals.
     */
    data: HospitalCreateManyInput | HospitalCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Hospital update
   */
  export type HospitalUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * The data needed to update a Hospital.
     */
    data: XOR<HospitalUpdateInput, HospitalUncheckedUpdateInput>
    /**
     * Choose, which Hospital to update.
     */
    where: HospitalWhereUniqueInput
  }

  /**
   * Hospital updateMany
   */
  export type HospitalUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Hospitals.
     */
    data: XOR<HospitalUpdateManyMutationInput, HospitalUncheckedUpdateManyInput>
    /**
     * Filter which Hospitals to update
     */
    where?: HospitalWhereInput
    /**
     * Limit how many Hospitals to update.
     */
    limit?: number
  }

  /**
   * Hospital updateManyAndReturn
   */
  export type HospitalUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * The data used to update Hospitals.
     */
    data: XOR<HospitalUpdateManyMutationInput, HospitalUncheckedUpdateManyInput>
    /**
     * Filter which Hospitals to update
     */
    where?: HospitalWhereInput
    /**
     * Limit how many Hospitals to update.
     */
    limit?: number
  }

  /**
   * Hospital upsert
   */
  export type HospitalUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * The filter to search for the Hospital to update in case it exists.
     */
    where: HospitalWhereUniqueInput
    /**
     * In case the Hospital found by the `where` argument doesn't exist, create a new Hospital with this data.
     */
    create: XOR<HospitalCreateInput, HospitalUncheckedCreateInput>
    /**
     * In case the Hospital was found with the provided `where` argument, update it with this data.
     */
    update: XOR<HospitalUpdateInput, HospitalUncheckedUpdateInput>
  }

  /**
   * Hospital delete
   */
  export type HospitalDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    /**
     * Filter which Hospital to delete.
     */
    where: HospitalWhereUniqueInput
  }

  /**
   * Hospital deleteMany
   */
  export type HospitalDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Hospitals to delete
     */
    where?: HospitalWhereInput
    /**
     * Limit how many Hospitals to delete.
     */
    limit?: number
  }

  /**
   * Hospital.encounters
   */
  export type Hospital$encountersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    where?: EncounterWhereInput
    orderBy?: EncounterOrderByWithRelationInput | EncounterOrderByWithRelationInput[]
    cursor?: EncounterWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EncounterScalarFieldEnum | EncounterScalarFieldEnum[]
  }

  /**
   * Hospital.users
   */
  export type Hospital$usersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    cursor?: UserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * Hospital without action
   */
  export type HospitalDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
  }


  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserAvgAggregateOutputType = {
    id: number | null
    hospitalId: number | null
  }

  export type UserSumAggregateOutputType = {
    id: number | null
    hospitalId: number | null
  }

  export type UserMinAggregateOutputType = {
    id: number | null
    email: string | null
    password: string | null
    role: $Enums.Role | null
    hospitalId: number | null
  }

  export type UserMaxAggregateOutputType = {
    id: number | null
    email: string | null
    password: string | null
    role: $Enums.Role | null
    hospitalId: number | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    password: number
    role: number
    hospitalId: number
    _all: number
  }


  export type UserAvgAggregateInputType = {
    id?: true
    hospitalId?: true
  }

  export type UserSumAggregateInputType = {
    id?: true
    hospitalId?: true
  }

  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    password?: true
    role?: true
    hospitalId?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    password?: true
    role?: true
    hospitalId?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    password?: true
    role?: true
    hospitalId?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _avg?: UserAvgAggregateInputType
    _sum?: UserSumAggregateInputType
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: number
    email: string
    password: string
    role: $Enums.Role
    hospitalId: number
    _count: UserCountAggregateOutputType | null
    _avg: UserAvgAggregateOutputType | null
    _sum: UserSumAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    password?: boolean
    role?: boolean
    hospitalId?: boolean
    hospital?: boolean | HospitalDefaultArgs<ExtArgs>
    triageNotes?: boolean | User$triageNotesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    password?: boolean
    role?: boolean
    hospitalId?: boolean
    hospital?: boolean | HospitalDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    password?: boolean
    role?: boolean
    hospitalId?: boolean
    hospital?: boolean | HospitalDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    password?: boolean
    role?: boolean
    hospitalId?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "password" | "role" | "hospitalId", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    hospital?: boolean | HospitalDefaultArgs<ExtArgs>
    triageNotes?: boolean | User$triageNotesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    hospital?: boolean | HospitalDefaultArgs<ExtArgs>
  }
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    hospital?: boolean | HospitalDefaultArgs<ExtArgs>
  }

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      hospital: Prisma.$HospitalPayload<ExtArgs>
      triageNotes: Prisma.$TriageNotePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      email: string
      password: string
      role: $Enums.Role
      hospitalId: number
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    hospital<T extends HospitalDefaultArgs<ExtArgs> = {}>(args?: Subset<T, HospitalDefaultArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    triageNotes<T extends User$triageNotesArgs<ExtArgs> = {}>(args?: Subset<T, User$triageNotesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'Int'>
    readonly email: FieldRef<"User", 'String'>
    readonly password: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'Role'>
    readonly hospitalId: FieldRef<"User", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.triageNotes
   */
  export type User$triageNotesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    where?: TriageNoteWhereInput
    orderBy?: TriageNoteOrderByWithRelationInput | TriageNoteOrderByWithRelationInput[]
    cursor?: TriageNoteWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TriageNoteScalarFieldEnum | TriageNoteScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Patient
   */

  export type AggregatePatient = {
    _count: PatientCountAggregateOutputType | null
    _avg: PatientAvgAggregateOutputType | null
    _sum: PatientSumAggregateOutputType | null
    _min: PatientMinAggregateOutputType | null
    _max: PatientMaxAggregateOutputType | null
  }

  export type PatientAvgAggregateOutputType = {
    id: number | null
  }

  export type PatientSumAggregateOutputType = {
    id: number | null
  }

  export type PatientMinAggregateOutputType = {
    id: number | null
    displayName: string | null
    phone: string | null
  }

  export type PatientMaxAggregateOutputType = {
    id: number | null
    displayName: string | null
    phone: string | null
  }

  export type PatientCountAggregateOutputType = {
    id: number
    displayName: number
    phone: number
    _all: number
  }


  export type PatientAvgAggregateInputType = {
    id?: true
  }

  export type PatientSumAggregateInputType = {
    id?: true
  }

  export type PatientMinAggregateInputType = {
    id?: true
    displayName?: true
    phone?: true
  }

  export type PatientMaxAggregateInputType = {
    id?: true
    displayName?: true
    phone?: true
  }

  export type PatientCountAggregateInputType = {
    id?: true
    displayName?: true
    phone?: true
    _all?: true
  }

  export type PatientAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Patient to aggregate.
     */
    where?: PatientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Patients to fetch.
     */
    orderBy?: PatientOrderByWithRelationInput | PatientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PatientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Patients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Patients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Patients
    **/
    _count?: true | PatientCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PatientAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PatientSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PatientMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PatientMaxAggregateInputType
  }

  export type GetPatientAggregateType<T extends PatientAggregateArgs> = {
        [P in keyof T & keyof AggregatePatient]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePatient[P]>
      : GetScalarType<T[P], AggregatePatient[P]>
  }




  export type PatientGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PatientWhereInput
    orderBy?: PatientOrderByWithAggregationInput | PatientOrderByWithAggregationInput[]
    by: PatientScalarFieldEnum[] | PatientScalarFieldEnum
    having?: PatientScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PatientCountAggregateInputType | true
    _avg?: PatientAvgAggregateInputType
    _sum?: PatientSumAggregateInputType
    _min?: PatientMinAggregateInputType
    _max?: PatientMaxAggregateInputType
  }

  export type PatientGroupByOutputType = {
    id: number
    displayName: string
    phone: string | null
    _count: PatientCountAggregateOutputType | null
    _avg: PatientAvgAggregateOutputType | null
    _sum: PatientSumAggregateOutputType | null
    _min: PatientMinAggregateOutputType | null
    _max: PatientMaxAggregateOutputType | null
  }

  type GetPatientGroupByPayload<T extends PatientGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PatientGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PatientGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PatientGroupByOutputType[P]>
            : GetScalarType<T[P], PatientGroupByOutputType[P]>
        }
      >
    >


  export type PatientSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    phone?: boolean
    encounters?: boolean | Patient$encountersArgs<ExtArgs>
    _count?: boolean | PatientCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["patient"]>

  export type PatientSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    phone?: boolean
  }, ExtArgs["result"]["patient"]>

  export type PatientSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    phone?: boolean
  }, ExtArgs["result"]["patient"]>

  export type PatientSelectScalar = {
    id?: boolean
    displayName?: boolean
    phone?: boolean
  }

  export type PatientOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "displayName" | "phone", ExtArgs["result"]["patient"]>
  export type PatientInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    encounters?: boolean | Patient$encountersArgs<ExtArgs>
    _count?: boolean | PatientCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type PatientIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type PatientIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $PatientPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Patient"
    objects: {
      encounters: Prisma.$EncounterPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      displayName: string
      phone: string | null
    }, ExtArgs["result"]["patient"]>
    composites: {}
  }

  type PatientGetPayload<S extends boolean | null | undefined | PatientDefaultArgs> = $Result.GetResult<Prisma.$PatientPayload, S>

  type PatientCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PatientFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PatientCountAggregateInputType | true
    }

  export interface PatientDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Patient'], meta: { name: 'Patient' } }
    /**
     * Find zero or one Patient that matches the filter.
     * @param {PatientFindUniqueArgs} args - Arguments to find a Patient
     * @example
     * // Get one Patient
     * const patient = await prisma.patient.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PatientFindUniqueArgs>(args: SelectSubset<T, PatientFindUniqueArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Patient that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PatientFindUniqueOrThrowArgs} args - Arguments to find a Patient
     * @example
     * // Get one Patient
     * const patient = await prisma.patient.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PatientFindUniqueOrThrowArgs>(args: SelectSubset<T, PatientFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Patient that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PatientFindFirstArgs} args - Arguments to find a Patient
     * @example
     * // Get one Patient
     * const patient = await prisma.patient.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PatientFindFirstArgs>(args?: SelectSubset<T, PatientFindFirstArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Patient that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PatientFindFirstOrThrowArgs} args - Arguments to find a Patient
     * @example
     * // Get one Patient
     * const patient = await prisma.patient.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PatientFindFirstOrThrowArgs>(args?: SelectSubset<T, PatientFindFirstOrThrowArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Patients that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PatientFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Patients
     * const patients = await prisma.patient.findMany()
     * 
     * // Get first 10 Patients
     * const patients = await prisma.patient.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const patientWithIdOnly = await prisma.patient.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PatientFindManyArgs>(args?: SelectSubset<T, PatientFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Patient.
     * @param {PatientCreateArgs} args - Arguments to create a Patient.
     * @example
     * // Create one Patient
     * const Patient = await prisma.patient.create({
     *   data: {
     *     // ... data to create a Patient
     *   }
     * })
     * 
     */
    create<T extends PatientCreateArgs>(args: SelectSubset<T, PatientCreateArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Patients.
     * @param {PatientCreateManyArgs} args - Arguments to create many Patients.
     * @example
     * // Create many Patients
     * const patient = await prisma.patient.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PatientCreateManyArgs>(args?: SelectSubset<T, PatientCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Patients and returns the data saved in the database.
     * @param {PatientCreateManyAndReturnArgs} args - Arguments to create many Patients.
     * @example
     * // Create many Patients
     * const patient = await prisma.patient.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Patients and only return the `id`
     * const patientWithIdOnly = await prisma.patient.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PatientCreateManyAndReturnArgs>(args?: SelectSubset<T, PatientCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Patient.
     * @param {PatientDeleteArgs} args - Arguments to delete one Patient.
     * @example
     * // Delete one Patient
     * const Patient = await prisma.patient.delete({
     *   where: {
     *     // ... filter to delete one Patient
     *   }
     * })
     * 
     */
    delete<T extends PatientDeleteArgs>(args: SelectSubset<T, PatientDeleteArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Patient.
     * @param {PatientUpdateArgs} args - Arguments to update one Patient.
     * @example
     * // Update one Patient
     * const patient = await prisma.patient.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PatientUpdateArgs>(args: SelectSubset<T, PatientUpdateArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Patients.
     * @param {PatientDeleteManyArgs} args - Arguments to filter Patients to delete.
     * @example
     * // Delete a few Patients
     * const { count } = await prisma.patient.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PatientDeleteManyArgs>(args?: SelectSubset<T, PatientDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Patients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PatientUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Patients
     * const patient = await prisma.patient.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PatientUpdateManyArgs>(args: SelectSubset<T, PatientUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Patients and returns the data updated in the database.
     * @param {PatientUpdateManyAndReturnArgs} args - Arguments to update many Patients.
     * @example
     * // Update many Patients
     * const patient = await prisma.patient.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Patients and only return the `id`
     * const patientWithIdOnly = await prisma.patient.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PatientUpdateManyAndReturnArgs>(args: SelectSubset<T, PatientUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Patient.
     * @param {PatientUpsertArgs} args - Arguments to update or create a Patient.
     * @example
     * // Update or create a Patient
     * const patient = await prisma.patient.upsert({
     *   create: {
     *     // ... data to create a Patient
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Patient we want to update
     *   }
     * })
     */
    upsert<T extends PatientUpsertArgs>(args: SelectSubset<T, PatientUpsertArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Patients.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PatientCountArgs} args - Arguments to filter Patients to count.
     * @example
     * // Count the number of Patients
     * const count = await prisma.patient.count({
     *   where: {
     *     // ... the filter for the Patients we want to count
     *   }
     * })
    **/
    count<T extends PatientCountArgs>(
      args?: Subset<T, PatientCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PatientCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Patient.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PatientAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PatientAggregateArgs>(args: Subset<T, PatientAggregateArgs>): Prisma.PrismaPromise<GetPatientAggregateType<T>>

    /**
     * Group by Patient.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PatientGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PatientGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PatientGroupByArgs['orderBy'] }
        : { orderBy?: PatientGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PatientGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPatientGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Patient model
   */
  readonly fields: PatientFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Patient.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PatientClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    encounters<T extends Patient$encountersArgs<ExtArgs> = {}>(args?: Subset<T, Patient$encountersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Patient model
   */
  interface PatientFieldRefs {
    readonly id: FieldRef<"Patient", 'Int'>
    readonly displayName: FieldRef<"Patient", 'String'>
    readonly phone: FieldRef<"Patient", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Patient findUnique
   */
  export type PatientFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * Filter, which Patient to fetch.
     */
    where: PatientWhereUniqueInput
  }

  /**
   * Patient findUniqueOrThrow
   */
  export type PatientFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * Filter, which Patient to fetch.
     */
    where: PatientWhereUniqueInput
  }

  /**
   * Patient findFirst
   */
  export type PatientFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * Filter, which Patient to fetch.
     */
    where?: PatientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Patients to fetch.
     */
    orderBy?: PatientOrderByWithRelationInput | PatientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Patients.
     */
    cursor?: PatientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Patients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Patients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Patients.
     */
    distinct?: PatientScalarFieldEnum | PatientScalarFieldEnum[]
  }

  /**
   * Patient findFirstOrThrow
   */
  export type PatientFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * Filter, which Patient to fetch.
     */
    where?: PatientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Patients to fetch.
     */
    orderBy?: PatientOrderByWithRelationInput | PatientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Patients.
     */
    cursor?: PatientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Patients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Patients.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Patients.
     */
    distinct?: PatientScalarFieldEnum | PatientScalarFieldEnum[]
  }

  /**
   * Patient findMany
   */
  export type PatientFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * Filter, which Patients to fetch.
     */
    where?: PatientWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Patients to fetch.
     */
    orderBy?: PatientOrderByWithRelationInput | PatientOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Patients.
     */
    cursor?: PatientWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Patients from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Patients.
     */
    skip?: number
    distinct?: PatientScalarFieldEnum | PatientScalarFieldEnum[]
  }

  /**
   * Patient create
   */
  export type PatientCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * The data needed to create a Patient.
     */
    data: XOR<PatientCreateInput, PatientUncheckedCreateInput>
  }

  /**
   * Patient createMany
   */
  export type PatientCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Patients.
     */
    data: PatientCreateManyInput | PatientCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Patient createManyAndReturn
   */
  export type PatientCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * The data used to create many Patients.
     */
    data: PatientCreateManyInput | PatientCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Patient update
   */
  export type PatientUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * The data needed to update a Patient.
     */
    data: XOR<PatientUpdateInput, PatientUncheckedUpdateInput>
    /**
     * Choose, which Patient to update.
     */
    where: PatientWhereUniqueInput
  }

  /**
   * Patient updateMany
   */
  export type PatientUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Patients.
     */
    data: XOR<PatientUpdateManyMutationInput, PatientUncheckedUpdateManyInput>
    /**
     * Filter which Patients to update
     */
    where?: PatientWhereInput
    /**
     * Limit how many Patients to update.
     */
    limit?: number
  }

  /**
   * Patient updateManyAndReturn
   */
  export type PatientUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * The data used to update Patients.
     */
    data: XOR<PatientUpdateManyMutationInput, PatientUncheckedUpdateManyInput>
    /**
     * Filter which Patients to update
     */
    where?: PatientWhereInput
    /**
     * Limit how many Patients to update.
     */
    limit?: number
  }

  /**
   * Patient upsert
   */
  export type PatientUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * The filter to search for the Patient to update in case it exists.
     */
    where: PatientWhereUniqueInput
    /**
     * In case the Patient found by the `where` argument doesn't exist, create a new Patient with this data.
     */
    create: XOR<PatientCreateInput, PatientUncheckedCreateInput>
    /**
     * In case the Patient was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PatientUpdateInput, PatientUncheckedUpdateInput>
  }

  /**
   * Patient delete
   */
  export type PatientDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
    /**
     * Filter which Patient to delete.
     */
    where: PatientWhereUniqueInput
  }

  /**
   * Patient deleteMany
   */
  export type PatientDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Patients to delete
     */
    where?: PatientWhereInput
    /**
     * Limit how many Patients to delete.
     */
    limit?: number
  }

  /**
   * Patient.encounters
   */
  export type Patient$encountersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    where?: EncounterWhereInput
    orderBy?: EncounterOrderByWithRelationInput | EncounterOrderByWithRelationInput[]
    cursor?: EncounterWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EncounterScalarFieldEnum | EncounterScalarFieldEnum[]
  }

  /**
   * Patient without action
   */
  export type PatientDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Patient
     */
    select?: PatientSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Patient
     */
    omit?: PatientOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PatientInclude<ExtArgs> | null
  }


  /**
   * Model Encounter
   */

  export type AggregateEncounter = {
    _count: EncounterCountAggregateOutputType | null
    _avg: EncounterAvgAggregateOutputType | null
    _sum: EncounterSumAggregateOutputType | null
    _min: EncounterMinAggregateOutputType | null
    _max: EncounterMaxAggregateOutputType | null
  }

  export type EncounterAvgAggregateOutputType = {
    id: number | null
    hospitalId: number | null
    patientId: number | null
  }

  export type EncounterSumAggregateOutputType = {
    id: number | null
    hospitalId: number | null
    patientId: number | null
  }

  export type EncounterMinAggregateOutputType = {
    id: number | null
    createdAt: Date | null
    updatedAt: Date | null
    status: $Enums.EncounterStatus | null
    hospitalName: string | null
    chiefComplaint: string | null
    details: string | null
    hospitalId: number | null
    patientId: number | null
  }

  export type EncounterMaxAggregateOutputType = {
    id: number | null
    createdAt: Date | null
    updatedAt: Date | null
    status: $Enums.EncounterStatus | null
    hospitalName: string | null
    chiefComplaint: string | null
    details: string | null
    hospitalId: number | null
    patientId: number | null
  }

  export type EncounterCountAggregateOutputType = {
    id: number
    createdAt: number
    updatedAt: number
    status: number
    hospitalName: number
    chiefComplaint: number
    details: number
    hospitalId: number
    patientId: number
    _all: number
  }


  export type EncounterAvgAggregateInputType = {
    id?: true
    hospitalId?: true
    patientId?: true
  }

  export type EncounterSumAggregateInputType = {
    id?: true
    hospitalId?: true
    patientId?: true
  }

  export type EncounterMinAggregateInputType = {
    id?: true
    createdAt?: true
    updatedAt?: true
    status?: true
    hospitalName?: true
    chiefComplaint?: true
    details?: true
    hospitalId?: true
    patientId?: true
  }

  export type EncounterMaxAggregateInputType = {
    id?: true
    createdAt?: true
    updatedAt?: true
    status?: true
    hospitalName?: true
    chiefComplaint?: true
    details?: true
    hospitalId?: true
    patientId?: true
  }

  export type EncounterCountAggregateInputType = {
    id?: true
    createdAt?: true
    updatedAt?: true
    status?: true
    hospitalName?: true
    chiefComplaint?: true
    details?: true
    hospitalId?: true
    patientId?: true
    _all?: true
  }

  export type EncounterAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Encounter to aggregate.
     */
    where?: EncounterWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Encounters to fetch.
     */
    orderBy?: EncounterOrderByWithRelationInput | EncounterOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EncounterWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Encounters from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Encounters.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Encounters
    **/
    _count?: true | EncounterCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: EncounterAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: EncounterSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EncounterMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EncounterMaxAggregateInputType
  }

  export type GetEncounterAggregateType<T extends EncounterAggregateArgs> = {
        [P in keyof T & keyof AggregateEncounter]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEncounter[P]>
      : GetScalarType<T[P], AggregateEncounter[P]>
  }




  export type EncounterGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EncounterWhereInput
    orderBy?: EncounterOrderByWithAggregationInput | EncounterOrderByWithAggregationInput[]
    by: EncounterScalarFieldEnum[] | EncounterScalarFieldEnum
    having?: EncounterScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EncounterCountAggregateInputType | true
    _avg?: EncounterAvgAggregateInputType
    _sum?: EncounterSumAggregateInputType
    _min?: EncounterMinAggregateInputType
    _max?: EncounterMaxAggregateInputType
  }

  export type EncounterGroupByOutputType = {
    id: number
    createdAt: Date
    updatedAt: Date
    status: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details: string | null
    hospitalId: number | null
    patientId: number
    _count: EncounterCountAggregateOutputType | null
    _avg: EncounterAvgAggregateOutputType | null
    _sum: EncounterSumAggregateOutputType | null
    _min: EncounterMinAggregateOutputType | null
    _max: EncounterMaxAggregateOutputType | null
  }

  type GetEncounterGroupByPayload<T extends EncounterGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EncounterGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EncounterGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EncounterGroupByOutputType[P]>
            : GetScalarType<T[P], EncounterGroupByOutputType[P]>
        }
      >
    >


  export type EncounterSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    status?: boolean
    hospitalName?: boolean
    chiefComplaint?: boolean
    details?: boolean
    hospitalId?: boolean
    patientId?: boolean
    hospital?: boolean | Encounter$hospitalArgs<ExtArgs>
    patient?: boolean | PatientDefaultArgs<ExtArgs>
    triageNotes?: boolean | Encounter$triageNotesArgs<ExtArgs>
    messages?: boolean | Encounter$messagesArgs<ExtArgs>
    _count?: boolean | EncounterCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["encounter"]>

  export type EncounterSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    status?: boolean
    hospitalName?: boolean
    chiefComplaint?: boolean
    details?: boolean
    hospitalId?: boolean
    patientId?: boolean
    hospital?: boolean | Encounter$hospitalArgs<ExtArgs>
    patient?: boolean | PatientDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["encounter"]>

  export type EncounterSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    status?: boolean
    hospitalName?: boolean
    chiefComplaint?: boolean
    details?: boolean
    hospitalId?: boolean
    patientId?: boolean
    hospital?: boolean | Encounter$hospitalArgs<ExtArgs>
    patient?: boolean | PatientDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["encounter"]>

  export type EncounterSelectScalar = {
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    status?: boolean
    hospitalName?: boolean
    chiefComplaint?: boolean
    details?: boolean
    hospitalId?: boolean
    patientId?: boolean
  }

  export type EncounterOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "createdAt" | "updatedAt" | "status" | "hospitalName" | "chiefComplaint" | "details" | "hospitalId" | "patientId", ExtArgs["result"]["encounter"]>
  export type EncounterInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    hospital?: boolean | Encounter$hospitalArgs<ExtArgs>
    patient?: boolean | PatientDefaultArgs<ExtArgs>
    triageNotes?: boolean | Encounter$triageNotesArgs<ExtArgs>
    messages?: boolean | Encounter$messagesArgs<ExtArgs>
    _count?: boolean | EncounterCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type EncounterIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    hospital?: boolean | Encounter$hospitalArgs<ExtArgs>
    patient?: boolean | PatientDefaultArgs<ExtArgs>
  }
  export type EncounterIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    hospital?: boolean | Encounter$hospitalArgs<ExtArgs>
    patient?: boolean | PatientDefaultArgs<ExtArgs>
  }

  export type $EncounterPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Encounter"
    objects: {
      hospital: Prisma.$HospitalPayload<ExtArgs> | null
      patient: Prisma.$PatientPayload<ExtArgs>
      triageNotes: Prisma.$TriageNotePayload<ExtArgs>[]
      messages: Prisma.$MessagePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      createdAt: Date
      updatedAt: Date
      status: $Enums.EncounterStatus
      hospitalName: string
      chiefComplaint: string
      details: string | null
      hospitalId: number | null
      patientId: number
    }, ExtArgs["result"]["encounter"]>
    composites: {}
  }

  type EncounterGetPayload<S extends boolean | null | undefined | EncounterDefaultArgs> = $Result.GetResult<Prisma.$EncounterPayload, S>

  type EncounterCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EncounterFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EncounterCountAggregateInputType | true
    }

  export interface EncounterDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Encounter'], meta: { name: 'Encounter' } }
    /**
     * Find zero or one Encounter that matches the filter.
     * @param {EncounterFindUniqueArgs} args - Arguments to find a Encounter
     * @example
     * // Get one Encounter
     * const encounter = await prisma.encounter.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EncounterFindUniqueArgs>(args: SelectSubset<T, EncounterFindUniqueArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Encounter that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EncounterFindUniqueOrThrowArgs} args - Arguments to find a Encounter
     * @example
     * // Get one Encounter
     * const encounter = await prisma.encounter.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EncounterFindUniqueOrThrowArgs>(args: SelectSubset<T, EncounterFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Encounter that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EncounterFindFirstArgs} args - Arguments to find a Encounter
     * @example
     * // Get one Encounter
     * const encounter = await prisma.encounter.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EncounterFindFirstArgs>(args?: SelectSubset<T, EncounterFindFirstArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Encounter that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EncounterFindFirstOrThrowArgs} args - Arguments to find a Encounter
     * @example
     * // Get one Encounter
     * const encounter = await prisma.encounter.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EncounterFindFirstOrThrowArgs>(args?: SelectSubset<T, EncounterFindFirstOrThrowArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Encounters that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EncounterFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Encounters
     * const encounters = await prisma.encounter.findMany()
     * 
     * // Get first 10 Encounters
     * const encounters = await prisma.encounter.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const encounterWithIdOnly = await prisma.encounter.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends EncounterFindManyArgs>(args?: SelectSubset<T, EncounterFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Encounter.
     * @param {EncounterCreateArgs} args - Arguments to create a Encounter.
     * @example
     * // Create one Encounter
     * const Encounter = await prisma.encounter.create({
     *   data: {
     *     // ... data to create a Encounter
     *   }
     * })
     * 
     */
    create<T extends EncounterCreateArgs>(args: SelectSubset<T, EncounterCreateArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Encounters.
     * @param {EncounterCreateManyArgs} args - Arguments to create many Encounters.
     * @example
     * // Create many Encounters
     * const encounter = await prisma.encounter.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EncounterCreateManyArgs>(args?: SelectSubset<T, EncounterCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Encounters and returns the data saved in the database.
     * @param {EncounterCreateManyAndReturnArgs} args - Arguments to create many Encounters.
     * @example
     * // Create many Encounters
     * const encounter = await prisma.encounter.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Encounters and only return the `id`
     * const encounterWithIdOnly = await prisma.encounter.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EncounterCreateManyAndReturnArgs>(args?: SelectSubset<T, EncounterCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Encounter.
     * @param {EncounterDeleteArgs} args - Arguments to delete one Encounter.
     * @example
     * // Delete one Encounter
     * const Encounter = await prisma.encounter.delete({
     *   where: {
     *     // ... filter to delete one Encounter
     *   }
     * })
     * 
     */
    delete<T extends EncounterDeleteArgs>(args: SelectSubset<T, EncounterDeleteArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Encounter.
     * @param {EncounterUpdateArgs} args - Arguments to update one Encounter.
     * @example
     * // Update one Encounter
     * const encounter = await prisma.encounter.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EncounterUpdateArgs>(args: SelectSubset<T, EncounterUpdateArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Encounters.
     * @param {EncounterDeleteManyArgs} args - Arguments to filter Encounters to delete.
     * @example
     * // Delete a few Encounters
     * const { count } = await prisma.encounter.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EncounterDeleteManyArgs>(args?: SelectSubset<T, EncounterDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Encounters.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EncounterUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Encounters
     * const encounter = await prisma.encounter.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EncounterUpdateManyArgs>(args: SelectSubset<T, EncounterUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Encounters and returns the data updated in the database.
     * @param {EncounterUpdateManyAndReturnArgs} args - Arguments to update many Encounters.
     * @example
     * // Update many Encounters
     * const encounter = await prisma.encounter.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Encounters and only return the `id`
     * const encounterWithIdOnly = await prisma.encounter.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EncounterUpdateManyAndReturnArgs>(args: SelectSubset<T, EncounterUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Encounter.
     * @param {EncounterUpsertArgs} args - Arguments to update or create a Encounter.
     * @example
     * // Update or create a Encounter
     * const encounter = await prisma.encounter.upsert({
     *   create: {
     *     // ... data to create a Encounter
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Encounter we want to update
     *   }
     * })
     */
    upsert<T extends EncounterUpsertArgs>(args: SelectSubset<T, EncounterUpsertArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Encounters.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EncounterCountArgs} args - Arguments to filter Encounters to count.
     * @example
     * // Count the number of Encounters
     * const count = await prisma.encounter.count({
     *   where: {
     *     // ... the filter for the Encounters we want to count
     *   }
     * })
    **/
    count<T extends EncounterCountArgs>(
      args?: Subset<T, EncounterCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EncounterCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Encounter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EncounterAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EncounterAggregateArgs>(args: Subset<T, EncounterAggregateArgs>): Prisma.PrismaPromise<GetEncounterAggregateType<T>>

    /**
     * Group by Encounter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EncounterGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EncounterGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EncounterGroupByArgs['orderBy'] }
        : { orderBy?: EncounterGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EncounterGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEncounterGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Encounter model
   */
  readonly fields: EncounterFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Encounter.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EncounterClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    hospital<T extends Encounter$hospitalArgs<ExtArgs> = {}>(args?: Subset<T, Encounter$hospitalArgs<ExtArgs>>): Prisma__HospitalClient<$Result.GetResult<Prisma.$HospitalPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    patient<T extends PatientDefaultArgs<ExtArgs> = {}>(args?: Subset<T, PatientDefaultArgs<ExtArgs>>): Prisma__PatientClient<$Result.GetResult<Prisma.$PatientPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    triageNotes<T extends Encounter$triageNotesArgs<ExtArgs> = {}>(args?: Subset<T, Encounter$triageNotesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    messages<T extends Encounter$messagesArgs<ExtArgs> = {}>(args?: Subset<T, Encounter$messagesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Encounter model
   */
  interface EncounterFieldRefs {
    readonly id: FieldRef<"Encounter", 'Int'>
    readonly createdAt: FieldRef<"Encounter", 'DateTime'>
    readonly updatedAt: FieldRef<"Encounter", 'DateTime'>
    readonly status: FieldRef<"Encounter", 'EncounterStatus'>
    readonly hospitalName: FieldRef<"Encounter", 'String'>
    readonly chiefComplaint: FieldRef<"Encounter", 'String'>
    readonly details: FieldRef<"Encounter", 'String'>
    readonly hospitalId: FieldRef<"Encounter", 'Int'>
    readonly patientId: FieldRef<"Encounter", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * Encounter findUnique
   */
  export type EncounterFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * Filter, which Encounter to fetch.
     */
    where: EncounterWhereUniqueInput
  }

  /**
   * Encounter findUniqueOrThrow
   */
  export type EncounterFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * Filter, which Encounter to fetch.
     */
    where: EncounterWhereUniqueInput
  }

  /**
   * Encounter findFirst
   */
  export type EncounterFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * Filter, which Encounter to fetch.
     */
    where?: EncounterWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Encounters to fetch.
     */
    orderBy?: EncounterOrderByWithRelationInput | EncounterOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Encounters.
     */
    cursor?: EncounterWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Encounters from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Encounters.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Encounters.
     */
    distinct?: EncounterScalarFieldEnum | EncounterScalarFieldEnum[]
  }

  /**
   * Encounter findFirstOrThrow
   */
  export type EncounterFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * Filter, which Encounter to fetch.
     */
    where?: EncounterWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Encounters to fetch.
     */
    orderBy?: EncounterOrderByWithRelationInput | EncounterOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Encounters.
     */
    cursor?: EncounterWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Encounters from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Encounters.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Encounters.
     */
    distinct?: EncounterScalarFieldEnum | EncounterScalarFieldEnum[]
  }

  /**
   * Encounter findMany
   */
  export type EncounterFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * Filter, which Encounters to fetch.
     */
    where?: EncounterWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Encounters to fetch.
     */
    orderBy?: EncounterOrderByWithRelationInput | EncounterOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Encounters.
     */
    cursor?: EncounterWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Encounters from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Encounters.
     */
    skip?: number
    distinct?: EncounterScalarFieldEnum | EncounterScalarFieldEnum[]
  }

  /**
   * Encounter create
   */
  export type EncounterCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * The data needed to create a Encounter.
     */
    data: XOR<EncounterCreateInput, EncounterUncheckedCreateInput>
  }

  /**
   * Encounter createMany
   */
  export type EncounterCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Encounters.
     */
    data: EncounterCreateManyInput | EncounterCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Encounter createManyAndReturn
   */
  export type EncounterCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * The data used to create many Encounters.
     */
    data: EncounterCreateManyInput | EncounterCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Encounter update
   */
  export type EncounterUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * The data needed to update a Encounter.
     */
    data: XOR<EncounterUpdateInput, EncounterUncheckedUpdateInput>
    /**
     * Choose, which Encounter to update.
     */
    where: EncounterWhereUniqueInput
  }

  /**
   * Encounter updateMany
   */
  export type EncounterUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Encounters.
     */
    data: XOR<EncounterUpdateManyMutationInput, EncounterUncheckedUpdateManyInput>
    /**
     * Filter which Encounters to update
     */
    where?: EncounterWhereInput
    /**
     * Limit how many Encounters to update.
     */
    limit?: number
  }

  /**
   * Encounter updateManyAndReturn
   */
  export type EncounterUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * The data used to update Encounters.
     */
    data: XOR<EncounterUpdateManyMutationInput, EncounterUncheckedUpdateManyInput>
    /**
     * Filter which Encounters to update
     */
    where?: EncounterWhereInput
    /**
     * Limit how many Encounters to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Encounter upsert
   */
  export type EncounterUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * The filter to search for the Encounter to update in case it exists.
     */
    where: EncounterWhereUniqueInput
    /**
     * In case the Encounter found by the `where` argument doesn't exist, create a new Encounter with this data.
     */
    create: XOR<EncounterCreateInput, EncounterUncheckedCreateInput>
    /**
     * In case the Encounter was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EncounterUpdateInput, EncounterUncheckedUpdateInput>
  }

  /**
   * Encounter delete
   */
  export type EncounterDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
    /**
     * Filter which Encounter to delete.
     */
    where: EncounterWhereUniqueInput
  }

  /**
   * Encounter deleteMany
   */
  export type EncounterDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Encounters to delete
     */
    where?: EncounterWhereInput
    /**
     * Limit how many Encounters to delete.
     */
    limit?: number
  }

  /**
   * Encounter.hospital
   */
  export type Encounter$hospitalArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Hospital
     */
    select?: HospitalSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Hospital
     */
    omit?: HospitalOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HospitalInclude<ExtArgs> | null
    where?: HospitalWhereInput
  }

  /**
   * Encounter.triageNotes
   */
  export type Encounter$triageNotesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    where?: TriageNoteWhereInput
    orderBy?: TriageNoteOrderByWithRelationInput | TriageNoteOrderByWithRelationInput[]
    cursor?: TriageNoteWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TriageNoteScalarFieldEnum | TriageNoteScalarFieldEnum[]
  }

  /**
   * Encounter.messages
   */
  export type Encounter$messagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    where?: MessageWhereInput
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    cursor?: MessageWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Encounter without action
   */
  export type EncounterDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Encounter
     */
    select?: EncounterSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Encounter
     */
    omit?: EncounterOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EncounterInclude<ExtArgs> | null
  }


  /**
   * Model TriageNote
   */

  export type AggregateTriageNote = {
    _count: TriageNoteCountAggregateOutputType | null
    _avg: TriageNoteAvgAggregateOutputType | null
    _sum: TriageNoteSumAggregateOutputType | null
    _min: TriageNoteMinAggregateOutputType | null
    _max: TriageNoteMaxAggregateOutputType | null
  }

  export type TriageNoteAvgAggregateOutputType = {
    id: number | null
    userId: number | null
    encounterId: number | null
  }

  export type TriageNoteSumAggregateOutputType = {
    id: number | null
    userId: number | null
    encounterId: number | null
  }

  export type TriageNoteMinAggregateOutputType = {
    id: number | null
    createdAt: Date | null
    note: string | null
    userId: number | null
    encounterId: number | null
  }

  export type TriageNoteMaxAggregateOutputType = {
    id: number | null
    createdAt: Date | null
    note: string | null
    userId: number | null
    encounterId: number | null
  }

  export type TriageNoteCountAggregateOutputType = {
    id: number
    createdAt: number
    note: number
    userId: number
    encounterId: number
    _all: number
  }


  export type TriageNoteAvgAggregateInputType = {
    id?: true
    userId?: true
    encounterId?: true
  }

  export type TriageNoteSumAggregateInputType = {
    id?: true
    userId?: true
    encounterId?: true
  }

  export type TriageNoteMinAggregateInputType = {
    id?: true
    createdAt?: true
    note?: true
    userId?: true
    encounterId?: true
  }

  export type TriageNoteMaxAggregateInputType = {
    id?: true
    createdAt?: true
    note?: true
    userId?: true
    encounterId?: true
  }

  export type TriageNoteCountAggregateInputType = {
    id?: true
    createdAt?: true
    note?: true
    userId?: true
    encounterId?: true
    _all?: true
  }

  export type TriageNoteAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TriageNote to aggregate.
     */
    where?: TriageNoteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TriageNotes to fetch.
     */
    orderBy?: TriageNoteOrderByWithRelationInput | TriageNoteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TriageNoteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TriageNotes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TriageNotes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TriageNotes
    **/
    _count?: true | TriageNoteCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TriageNoteAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TriageNoteSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TriageNoteMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TriageNoteMaxAggregateInputType
  }

  export type GetTriageNoteAggregateType<T extends TriageNoteAggregateArgs> = {
        [P in keyof T & keyof AggregateTriageNote]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTriageNote[P]>
      : GetScalarType<T[P], AggregateTriageNote[P]>
  }




  export type TriageNoteGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TriageNoteWhereInput
    orderBy?: TriageNoteOrderByWithAggregationInput | TriageNoteOrderByWithAggregationInput[]
    by: TriageNoteScalarFieldEnum[] | TriageNoteScalarFieldEnum
    having?: TriageNoteScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TriageNoteCountAggregateInputType | true
    _avg?: TriageNoteAvgAggregateInputType
    _sum?: TriageNoteSumAggregateInputType
    _min?: TriageNoteMinAggregateInputType
    _max?: TriageNoteMaxAggregateInputType
  }

  export type TriageNoteGroupByOutputType = {
    id: number
    createdAt: Date
    note: string
    userId: number | null
    encounterId: number
    _count: TriageNoteCountAggregateOutputType | null
    _avg: TriageNoteAvgAggregateOutputType | null
    _sum: TriageNoteSumAggregateOutputType | null
    _min: TriageNoteMinAggregateOutputType | null
    _max: TriageNoteMaxAggregateOutputType | null
  }

  type GetTriageNoteGroupByPayload<T extends TriageNoteGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TriageNoteGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TriageNoteGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TriageNoteGroupByOutputType[P]>
            : GetScalarType<T[P], TriageNoteGroupByOutputType[P]>
        }
      >
    >


  export type TriageNoteSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    note?: boolean
    userId?: boolean
    encounterId?: boolean
    createdBy?: boolean | TriageNote$createdByArgs<ExtArgs>
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["triageNote"]>

  export type TriageNoteSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    note?: boolean
    userId?: boolean
    encounterId?: boolean
    createdBy?: boolean | TriageNote$createdByArgs<ExtArgs>
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["triageNote"]>

  export type TriageNoteSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    note?: boolean
    userId?: boolean
    encounterId?: boolean
    createdBy?: boolean | TriageNote$createdByArgs<ExtArgs>
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["triageNote"]>

  export type TriageNoteSelectScalar = {
    id?: boolean
    createdAt?: boolean
    note?: boolean
    userId?: boolean
    encounterId?: boolean
  }

  export type TriageNoteOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "createdAt" | "note" | "userId" | "encounterId", ExtArgs["result"]["triageNote"]>
  export type TriageNoteInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    createdBy?: boolean | TriageNote$createdByArgs<ExtArgs>
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }
  export type TriageNoteIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    createdBy?: boolean | TriageNote$createdByArgs<ExtArgs>
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }
  export type TriageNoteIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    createdBy?: boolean | TriageNote$createdByArgs<ExtArgs>
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }

  export type $TriageNotePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TriageNote"
    objects: {
      createdBy: Prisma.$UserPayload<ExtArgs> | null
      encounter: Prisma.$EncounterPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      createdAt: Date
      note: string
      userId: number | null
      encounterId: number
    }, ExtArgs["result"]["triageNote"]>
    composites: {}
  }

  type TriageNoteGetPayload<S extends boolean | null | undefined | TriageNoteDefaultArgs> = $Result.GetResult<Prisma.$TriageNotePayload, S>

  type TriageNoteCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TriageNoteFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TriageNoteCountAggregateInputType | true
    }

  export interface TriageNoteDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TriageNote'], meta: { name: 'TriageNote' } }
    /**
     * Find zero or one TriageNote that matches the filter.
     * @param {TriageNoteFindUniqueArgs} args - Arguments to find a TriageNote
     * @example
     * // Get one TriageNote
     * const triageNote = await prisma.triageNote.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TriageNoteFindUniqueArgs>(args: SelectSubset<T, TriageNoteFindUniqueArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TriageNote that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TriageNoteFindUniqueOrThrowArgs} args - Arguments to find a TriageNote
     * @example
     * // Get one TriageNote
     * const triageNote = await prisma.triageNote.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TriageNoteFindUniqueOrThrowArgs>(args: SelectSubset<T, TriageNoteFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TriageNote that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TriageNoteFindFirstArgs} args - Arguments to find a TriageNote
     * @example
     * // Get one TriageNote
     * const triageNote = await prisma.triageNote.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TriageNoteFindFirstArgs>(args?: SelectSubset<T, TriageNoteFindFirstArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TriageNote that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TriageNoteFindFirstOrThrowArgs} args - Arguments to find a TriageNote
     * @example
     * // Get one TriageNote
     * const triageNote = await prisma.triageNote.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TriageNoteFindFirstOrThrowArgs>(args?: SelectSubset<T, TriageNoteFindFirstOrThrowArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TriageNotes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TriageNoteFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TriageNotes
     * const triageNotes = await prisma.triageNote.findMany()
     * 
     * // Get first 10 TriageNotes
     * const triageNotes = await prisma.triageNote.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const triageNoteWithIdOnly = await prisma.triageNote.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TriageNoteFindManyArgs>(args?: SelectSubset<T, TriageNoteFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TriageNote.
     * @param {TriageNoteCreateArgs} args - Arguments to create a TriageNote.
     * @example
     * // Create one TriageNote
     * const TriageNote = await prisma.triageNote.create({
     *   data: {
     *     // ... data to create a TriageNote
     *   }
     * })
     * 
     */
    create<T extends TriageNoteCreateArgs>(args: SelectSubset<T, TriageNoteCreateArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TriageNotes.
     * @param {TriageNoteCreateManyArgs} args - Arguments to create many TriageNotes.
     * @example
     * // Create many TriageNotes
     * const triageNote = await prisma.triageNote.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TriageNoteCreateManyArgs>(args?: SelectSubset<T, TriageNoteCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TriageNotes and returns the data saved in the database.
     * @param {TriageNoteCreateManyAndReturnArgs} args - Arguments to create many TriageNotes.
     * @example
     * // Create many TriageNotes
     * const triageNote = await prisma.triageNote.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TriageNotes and only return the `id`
     * const triageNoteWithIdOnly = await prisma.triageNote.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TriageNoteCreateManyAndReturnArgs>(args?: SelectSubset<T, TriageNoteCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TriageNote.
     * @param {TriageNoteDeleteArgs} args - Arguments to delete one TriageNote.
     * @example
     * // Delete one TriageNote
     * const TriageNote = await prisma.triageNote.delete({
     *   where: {
     *     // ... filter to delete one TriageNote
     *   }
     * })
     * 
     */
    delete<T extends TriageNoteDeleteArgs>(args: SelectSubset<T, TriageNoteDeleteArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TriageNote.
     * @param {TriageNoteUpdateArgs} args - Arguments to update one TriageNote.
     * @example
     * // Update one TriageNote
     * const triageNote = await prisma.triageNote.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TriageNoteUpdateArgs>(args: SelectSubset<T, TriageNoteUpdateArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TriageNotes.
     * @param {TriageNoteDeleteManyArgs} args - Arguments to filter TriageNotes to delete.
     * @example
     * // Delete a few TriageNotes
     * const { count } = await prisma.triageNote.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TriageNoteDeleteManyArgs>(args?: SelectSubset<T, TriageNoteDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TriageNotes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TriageNoteUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TriageNotes
     * const triageNote = await prisma.triageNote.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TriageNoteUpdateManyArgs>(args: SelectSubset<T, TriageNoteUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TriageNotes and returns the data updated in the database.
     * @param {TriageNoteUpdateManyAndReturnArgs} args - Arguments to update many TriageNotes.
     * @example
     * // Update many TriageNotes
     * const triageNote = await prisma.triageNote.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TriageNotes and only return the `id`
     * const triageNoteWithIdOnly = await prisma.triageNote.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TriageNoteUpdateManyAndReturnArgs>(args: SelectSubset<T, TriageNoteUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TriageNote.
     * @param {TriageNoteUpsertArgs} args - Arguments to update or create a TriageNote.
     * @example
     * // Update or create a TriageNote
     * const triageNote = await prisma.triageNote.upsert({
     *   create: {
     *     // ... data to create a TriageNote
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TriageNote we want to update
     *   }
     * })
     */
    upsert<T extends TriageNoteUpsertArgs>(args: SelectSubset<T, TriageNoteUpsertArgs<ExtArgs>>): Prisma__TriageNoteClient<$Result.GetResult<Prisma.$TriageNotePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TriageNotes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TriageNoteCountArgs} args - Arguments to filter TriageNotes to count.
     * @example
     * // Count the number of TriageNotes
     * const count = await prisma.triageNote.count({
     *   where: {
     *     // ... the filter for the TriageNotes we want to count
     *   }
     * })
    **/
    count<T extends TriageNoteCountArgs>(
      args?: Subset<T, TriageNoteCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TriageNoteCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TriageNote.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TriageNoteAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TriageNoteAggregateArgs>(args: Subset<T, TriageNoteAggregateArgs>): Prisma.PrismaPromise<GetTriageNoteAggregateType<T>>

    /**
     * Group by TriageNote.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TriageNoteGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TriageNoteGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TriageNoteGroupByArgs['orderBy'] }
        : { orderBy?: TriageNoteGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TriageNoteGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTriageNoteGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TriageNote model
   */
  readonly fields: TriageNoteFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TriageNote.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TriageNoteClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    createdBy<T extends TriageNote$createdByArgs<ExtArgs> = {}>(args?: Subset<T, TriageNote$createdByArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    encounter<T extends EncounterDefaultArgs<ExtArgs> = {}>(args?: Subset<T, EncounterDefaultArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TriageNote model
   */
  interface TriageNoteFieldRefs {
    readonly id: FieldRef<"TriageNote", 'Int'>
    readonly createdAt: FieldRef<"TriageNote", 'DateTime'>
    readonly note: FieldRef<"TriageNote", 'String'>
    readonly userId: FieldRef<"TriageNote", 'Int'>
    readonly encounterId: FieldRef<"TriageNote", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * TriageNote findUnique
   */
  export type TriageNoteFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * Filter, which TriageNote to fetch.
     */
    where: TriageNoteWhereUniqueInput
  }

  /**
   * TriageNote findUniqueOrThrow
   */
  export type TriageNoteFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * Filter, which TriageNote to fetch.
     */
    where: TriageNoteWhereUniqueInput
  }

  /**
   * TriageNote findFirst
   */
  export type TriageNoteFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * Filter, which TriageNote to fetch.
     */
    where?: TriageNoteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TriageNotes to fetch.
     */
    orderBy?: TriageNoteOrderByWithRelationInput | TriageNoteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TriageNotes.
     */
    cursor?: TriageNoteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TriageNotes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TriageNotes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TriageNotes.
     */
    distinct?: TriageNoteScalarFieldEnum | TriageNoteScalarFieldEnum[]
  }

  /**
   * TriageNote findFirstOrThrow
   */
  export type TriageNoteFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * Filter, which TriageNote to fetch.
     */
    where?: TriageNoteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TriageNotes to fetch.
     */
    orderBy?: TriageNoteOrderByWithRelationInput | TriageNoteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TriageNotes.
     */
    cursor?: TriageNoteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TriageNotes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TriageNotes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TriageNotes.
     */
    distinct?: TriageNoteScalarFieldEnum | TriageNoteScalarFieldEnum[]
  }

  /**
   * TriageNote findMany
   */
  export type TriageNoteFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * Filter, which TriageNotes to fetch.
     */
    where?: TriageNoteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TriageNotes to fetch.
     */
    orderBy?: TriageNoteOrderByWithRelationInput | TriageNoteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TriageNotes.
     */
    cursor?: TriageNoteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TriageNotes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TriageNotes.
     */
    skip?: number
    distinct?: TriageNoteScalarFieldEnum | TriageNoteScalarFieldEnum[]
  }

  /**
   * TriageNote create
   */
  export type TriageNoteCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * The data needed to create a TriageNote.
     */
    data: XOR<TriageNoteCreateInput, TriageNoteUncheckedCreateInput>
  }

  /**
   * TriageNote createMany
   */
  export type TriageNoteCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TriageNotes.
     */
    data: TriageNoteCreateManyInput | TriageNoteCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TriageNote createManyAndReturn
   */
  export type TriageNoteCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * The data used to create many TriageNotes.
     */
    data: TriageNoteCreateManyInput | TriageNoteCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * TriageNote update
   */
  export type TriageNoteUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * The data needed to update a TriageNote.
     */
    data: XOR<TriageNoteUpdateInput, TriageNoteUncheckedUpdateInput>
    /**
     * Choose, which TriageNote to update.
     */
    where: TriageNoteWhereUniqueInput
  }

  /**
   * TriageNote updateMany
   */
  export type TriageNoteUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TriageNotes.
     */
    data: XOR<TriageNoteUpdateManyMutationInput, TriageNoteUncheckedUpdateManyInput>
    /**
     * Filter which TriageNotes to update
     */
    where?: TriageNoteWhereInput
    /**
     * Limit how many TriageNotes to update.
     */
    limit?: number
  }

  /**
   * TriageNote updateManyAndReturn
   */
  export type TriageNoteUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * The data used to update TriageNotes.
     */
    data: XOR<TriageNoteUpdateManyMutationInput, TriageNoteUncheckedUpdateManyInput>
    /**
     * Filter which TriageNotes to update
     */
    where?: TriageNoteWhereInput
    /**
     * Limit how many TriageNotes to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * TriageNote upsert
   */
  export type TriageNoteUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * The filter to search for the TriageNote to update in case it exists.
     */
    where: TriageNoteWhereUniqueInput
    /**
     * In case the TriageNote found by the `where` argument doesn't exist, create a new TriageNote with this data.
     */
    create: XOR<TriageNoteCreateInput, TriageNoteUncheckedCreateInput>
    /**
     * In case the TriageNote was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TriageNoteUpdateInput, TriageNoteUncheckedUpdateInput>
  }

  /**
   * TriageNote delete
   */
  export type TriageNoteDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
    /**
     * Filter which TriageNote to delete.
     */
    where: TriageNoteWhereUniqueInput
  }

  /**
   * TriageNote deleteMany
   */
  export type TriageNoteDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TriageNotes to delete
     */
    where?: TriageNoteWhereInput
    /**
     * Limit how many TriageNotes to delete.
     */
    limit?: number
  }

  /**
   * TriageNote.createdBy
   */
  export type TriageNote$createdByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * TriageNote without action
   */
  export type TriageNoteDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TriageNote
     */
    select?: TriageNoteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TriageNote
     */
    omit?: TriageNoteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TriageNoteInclude<ExtArgs> | null
  }


  /**
   * Model Message
   */

  export type AggregateMessage = {
    _count: MessageCountAggregateOutputType | null
    _avg: MessageAvgAggregateOutputType | null
    _sum: MessageSumAggregateOutputType | null
    _min: MessageMinAggregateOutputType | null
    _max: MessageMaxAggregateOutputType | null
  }

  export type MessageAvgAggregateOutputType = {
    id: number | null
    encounterId: number | null
  }

  export type MessageSumAggregateOutputType = {
    id: number | null
    encounterId: number | null
  }

  export type MessageMinAggregateOutputType = {
    id: number | null
    createdAt: Date | null
    from: $Enums.MessageAuthor | null
    content: string | null
    encounterId: number | null
  }

  export type MessageMaxAggregateOutputType = {
    id: number | null
    createdAt: Date | null
    from: $Enums.MessageAuthor | null
    content: string | null
    encounterId: number | null
  }

  export type MessageCountAggregateOutputType = {
    id: number
    createdAt: number
    from: number
    content: number
    encounterId: number
    _all: number
  }


  export type MessageAvgAggregateInputType = {
    id?: true
    encounterId?: true
  }

  export type MessageSumAggregateInputType = {
    id?: true
    encounterId?: true
  }

  export type MessageMinAggregateInputType = {
    id?: true
    createdAt?: true
    from?: true
    content?: true
    encounterId?: true
  }

  export type MessageMaxAggregateInputType = {
    id?: true
    createdAt?: true
    from?: true
    content?: true
    encounterId?: true
  }

  export type MessageCountAggregateInputType = {
    id?: true
    createdAt?: true
    from?: true
    content?: true
    encounterId?: true
    _all?: true
  }

  export type MessageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Message to aggregate.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Messages
    **/
    _count?: true | MessageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MessageAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MessageSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MessageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MessageMaxAggregateInputType
  }

  export type GetMessageAggregateType<T extends MessageAggregateArgs> = {
        [P in keyof T & keyof AggregateMessage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMessage[P]>
      : GetScalarType<T[P], AggregateMessage[P]>
  }




  export type MessageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MessageWhereInput
    orderBy?: MessageOrderByWithAggregationInput | MessageOrderByWithAggregationInput[]
    by: MessageScalarFieldEnum[] | MessageScalarFieldEnum
    having?: MessageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MessageCountAggregateInputType | true
    _avg?: MessageAvgAggregateInputType
    _sum?: MessageSumAggregateInputType
    _min?: MessageMinAggregateInputType
    _max?: MessageMaxAggregateInputType
  }

  export type MessageGroupByOutputType = {
    id: number
    createdAt: Date
    from: $Enums.MessageAuthor
    content: string
    encounterId: number
    _count: MessageCountAggregateOutputType | null
    _avg: MessageAvgAggregateOutputType | null
    _sum: MessageSumAggregateOutputType | null
    _min: MessageMinAggregateOutputType | null
    _max: MessageMaxAggregateOutputType | null
  }

  type GetMessageGroupByPayload<T extends MessageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MessageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MessageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MessageGroupByOutputType[P]>
            : GetScalarType<T[P], MessageGroupByOutputType[P]>
        }
      >
    >


  export type MessageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    from?: boolean
    content?: boolean
    encounterId?: boolean
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    from?: boolean
    content?: boolean
    encounterId?: boolean
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    createdAt?: boolean
    from?: boolean
    content?: boolean
    encounterId?: boolean
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectScalar = {
    id?: boolean
    createdAt?: boolean
    from?: boolean
    content?: boolean
    encounterId?: boolean
  }

  export type MessageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "createdAt" | "from" | "content" | "encounterId", ExtArgs["result"]["message"]>
  export type MessageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }
  export type MessageIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }
  export type MessageIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    encounter?: boolean | EncounterDefaultArgs<ExtArgs>
  }

  export type $MessagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Message"
    objects: {
      encounter: Prisma.$EncounterPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      createdAt: Date
      from: $Enums.MessageAuthor
      content: string
      encounterId: number
    }, ExtArgs["result"]["message"]>
    composites: {}
  }

  type MessageGetPayload<S extends boolean | null | undefined | MessageDefaultArgs> = $Result.GetResult<Prisma.$MessagePayload, S>

  type MessageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MessageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MessageCountAggregateInputType | true
    }

  export interface MessageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Message'], meta: { name: 'Message' } }
    /**
     * Find zero or one Message that matches the filter.
     * @param {MessageFindUniqueArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MessageFindUniqueArgs>(args: SelectSubset<T, MessageFindUniqueArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Message that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MessageFindUniqueOrThrowArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MessageFindUniqueOrThrowArgs>(args: SelectSubset<T, MessageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Message that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindFirstArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MessageFindFirstArgs>(args?: SelectSubset<T, MessageFindFirstArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Message that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindFirstOrThrowArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MessageFindFirstOrThrowArgs>(args?: SelectSubset<T, MessageFindFirstOrThrowArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Messages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Messages
     * const messages = await prisma.message.findMany()
     * 
     * // Get first 10 Messages
     * const messages = await prisma.message.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const messageWithIdOnly = await prisma.message.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MessageFindManyArgs>(args?: SelectSubset<T, MessageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Message.
     * @param {MessageCreateArgs} args - Arguments to create a Message.
     * @example
     * // Create one Message
     * const Message = await prisma.message.create({
     *   data: {
     *     // ... data to create a Message
     *   }
     * })
     * 
     */
    create<T extends MessageCreateArgs>(args: SelectSubset<T, MessageCreateArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Messages.
     * @param {MessageCreateManyArgs} args - Arguments to create many Messages.
     * @example
     * // Create many Messages
     * const message = await prisma.message.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MessageCreateManyArgs>(args?: SelectSubset<T, MessageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Messages and returns the data saved in the database.
     * @param {MessageCreateManyAndReturnArgs} args - Arguments to create many Messages.
     * @example
     * // Create many Messages
     * const message = await prisma.message.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Messages and only return the `id`
     * const messageWithIdOnly = await prisma.message.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MessageCreateManyAndReturnArgs>(args?: SelectSubset<T, MessageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Message.
     * @param {MessageDeleteArgs} args - Arguments to delete one Message.
     * @example
     * // Delete one Message
     * const Message = await prisma.message.delete({
     *   where: {
     *     // ... filter to delete one Message
     *   }
     * })
     * 
     */
    delete<T extends MessageDeleteArgs>(args: SelectSubset<T, MessageDeleteArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Message.
     * @param {MessageUpdateArgs} args - Arguments to update one Message.
     * @example
     * // Update one Message
     * const message = await prisma.message.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MessageUpdateArgs>(args: SelectSubset<T, MessageUpdateArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Messages.
     * @param {MessageDeleteManyArgs} args - Arguments to filter Messages to delete.
     * @example
     * // Delete a few Messages
     * const { count } = await prisma.message.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MessageDeleteManyArgs>(args?: SelectSubset<T, MessageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Messages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Messages
     * const message = await prisma.message.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MessageUpdateManyArgs>(args: SelectSubset<T, MessageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Messages and returns the data updated in the database.
     * @param {MessageUpdateManyAndReturnArgs} args - Arguments to update many Messages.
     * @example
     * // Update many Messages
     * const message = await prisma.message.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Messages and only return the `id`
     * const messageWithIdOnly = await prisma.message.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends MessageUpdateManyAndReturnArgs>(args: SelectSubset<T, MessageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Message.
     * @param {MessageUpsertArgs} args - Arguments to update or create a Message.
     * @example
     * // Update or create a Message
     * const message = await prisma.message.upsert({
     *   create: {
     *     // ... data to create a Message
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Message we want to update
     *   }
     * })
     */
    upsert<T extends MessageUpsertArgs>(args: SelectSubset<T, MessageUpsertArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Messages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageCountArgs} args - Arguments to filter Messages to count.
     * @example
     * // Count the number of Messages
     * const count = await prisma.message.count({
     *   where: {
     *     // ... the filter for the Messages we want to count
     *   }
     * })
    **/
    count<T extends MessageCountArgs>(
      args?: Subset<T, MessageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MessageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Message.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MessageAggregateArgs>(args: Subset<T, MessageAggregateArgs>): Prisma.PrismaPromise<GetMessageAggregateType<T>>

    /**
     * Group by Message.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MessageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MessageGroupByArgs['orderBy'] }
        : { orderBy?: MessageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MessageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMessageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Message model
   */
  readonly fields: MessageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Message.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MessageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    encounter<T extends EncounterDefaultArgs<ExtArgs> = {}>(args?: Subset<T, EncounterDefaultArgs<ExtArgs>>): Prisma__EncounterClient<$Result.GetResult<Prisma.$EncounterPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Message model
   */
  interface MessageFieldRefs {
    readonly id: FieldRef<"Message", 'Int'>
    readonly createdAt: FieldRef<"Message", 'DateTime'>
    readonly from: FieldRef<"Message", 'MessageAuthor'>
    readonly content: FieldRef<"Message", 'String'>
    readonly encounterId: FieldRef<"Message", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * Message findUnique
   */
  export type MessageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message findUniqueOrThrow
   */
  export type MessageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message findFirst
   */
  export type MessageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message findFirstOrThrow
   */
  export type MessageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message findMany
   */
  export type MessageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Messages to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message create
   */
  export type MessageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The data needed to create a Message.
     */
    data: XOR<MessageCreateInput, MessageUncheckedCreateInput>
  }

  /**
   * Message createMany
   */
  export type MessageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Messages.
     */
    data: MessageCreateManyInput | MessageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Message createManyAndReturn
   */
  export type MessageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * The data used to create many Messages.
     */
    data: MessageCreateManyInput | MessageCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Message update
   */
  export type MessageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The data needed to update a Message.
     */
    data: XOR<MessageUpdateInput, MessageUncheckedUpdateInput>
    /**
     * Choose, which Message to update.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message updateMany
   */
  export type MessageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Messages.
     */
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyInput>
    /**
     * Filter which Messages to update
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to update.
     */
    limit?: number
  }

  /**
   * Message updateManyAndReturn
   */
  export type MessageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * The data used to update Messages.
     */
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyInput>
    /**
     * Filter which Messages to update
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Message upsert
   */
  export type MessageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The filter to search for the Message to update in case it exists.
     */
    where: MessageWhereUniqueInput
    /**
     * In case the Message found by the `where` argument doesn't exist, create a new Message with this data.
     */
    create: XOR<MessageCreateInput, MessageUncheckedCreateInput>
    /**
     * In case the Message was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MessageUpdateInput, MessageUncheckedUpdateInput>
  }

  /**
   * Message delete
   */
  export type MessageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter which Message to delete.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message deleteMany
   */
  export type MessageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Messages to delete
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to delete.
     */
    limit?: number
  }

  /**
   * Message without action
   */
  export type MessageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const HospitalScalarFieldEnum: {
    id: 'id',
    name: 'name',
    slug: 'slug'
  };

  export type HospitalScalarFieldEnum = (typeof HospitalScalarFieldEnum)[keyof typeof HospitalScalarFieldEnum]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    password: 'password',
    role: 'role',
    hospitalId: 'hospitalId'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const PatientScalarFieldEnum: {
    id: 'id',
    displayName: 'displayName',
    phone: 'phone'
  };

  export type PatientScalarFieldEnum = (typeof PatientScalarFieldEnum)[keyof typeof PatientScalarFieldEnum]


  export const EncounterScalarFieldEnum: {
    id: 'id',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    status: 'status',
    hospitalName: 'hospitalName',
    chiefComplaint: 'chiefComplaint',
    details: 'details',
    hospitalId: 'hospitalId',
    patientId: 'patientId'
  };

  export type EncounterScalarFieldEnum = (typeof EncounterScalarFieldEnum)[keyof typeof EncounterScalarFieldEnum]


  export const TriageNoteScalarFieldEnum: {
    id: 'id',
    createdAt: 'createdAt',
    note: 'note',
    userId: 'userId',
    encounterId: 'encounterId'
  };

  export type TriageNoteScalarFieldEnum = (typeof TriageNoteScalarFieldEnum)[keyof typeof TriageNoteScalarFieldEnum]


  export const MessageScalarFieldEnum: {
    id: 'id',
    createdAt: 'createdAt',
    from: 'from',
    content: 'content',
    encounterId: 'encounterId'
  };

  export type MessageScalarFieldEnum = (typeof MessageScalarFieldEnum)[keyof typeof MessageScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Role'
   */
  export type EnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role'>
    


  /**
   * Reference to a field of type 'Role[]'
   */
  export type ListEnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'EncounterStatus'
   */
  export type EnumEncounterStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EncounterStatus'>
    


  /**
   * Reference to a field of type 'EncounterStatus[]'
   */
  export type ListEnumEncounterStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'EncounterStatus[]'>
    


  /**
   * Reference to a field of type 'MessageAuthor'
   */
  export type EnumMessageAuthorFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'MessageAuthor'>
    


  /**
   * Reference to a field of type 'MessageAuthor[]'
   */
  export type ListEnumMessageAuthorFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'MessageAuthor[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type HospitalWhereInput = {
    AND?: HospitalWhereInput | HospitalWhereInput[]
    OR?: HospitalWhereInput[]
    NOT?: HospitalWhereInput | HospitalWhereInput[]
    id?: IntFilter<"Hospital"> | number
    name?: StringFilter<"Hospital"> | string
    slug?: StringFilter<"Hospital"> | string
    encounters?: EncounterListRelationFilter
    users?: UserListRelationFilter
  }

  export type HospitalOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
    encounters?: EncounterOrderByRelationAggregateInput
    users?: UserOrderByRelationAggregateInput
  }

  export type HospitalWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    slug?: string
    AND?: HospitalWhereInput | HospitalWhereInput[]
    OR?: HospitalWhereInput[]
    NOT?: HospitalWhereInput | HospitalWhereInput[]
    name?: StringFilter<"Hospital"> | string
    encounters?: EncounterListRelationFilter
    users?: UserListRelationFilter
  }, "id" | "slug">

  export type HospitalOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
    _count?: HospitalCountOrderByAggregateInput
    _avg?: HospitalAvgOrderByAggregateInput
    _max?: HospitalMaxOrderByAggregateInput
    _min?: HospitalMinOrderByAggregateInput
    _sum?: HospitalSumOrderByAggregateInput
  }

  export type HospitalScalarWhereWithAggregatesInput = {
    AND?: HospitalScalarWhereWithAggregatesInput | HospitalScalarWhereWithAggregatesInput[]
    OR?: HospitalScalarWhereWithAggregatesInput[]
    NOT?: HospitalScalarWhereWithAggregatesInput | HospitalScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Hospital"> | number
    name?: StringWithAggregatesFilter<"Hospital"> | string
    slug?: StringWithAggregatesFilter<"Hospital"> | string
  }

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: IntFilter<"User"> | number
    email?: StringFilter<"User"> | string
    password?: StringFilter<"User"> | string
    role?: EnumRoleFilter<"User"> | $Enums.Role
    hospitalId?: IntFilter<"User"> | number
    hospital?: XOR<HospitalScalarRelationFilter, HospitalWhereInput>
    triageNotes?: TriageNoteListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    hospitalId?: SortOrder
    hospital?: HospitalOrderByWithRelationInput
    triageNotes?: TriageNoteOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    password?: StringFilter<"User"> | string
    role?: EnumRoleFilter<"User"> | $Enums.Role
    hospitalId?: IntFilter<"User"> | number
    hospital?: XOR<HospitalScalarRelationFilter, HospitalWhereInput>
    triageNotes?: TriageNoteListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    hospitalId?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _avg?: UserAvgOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
    _sum?: UserSumOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"User"> | number
    email?: StringWithAggregatesFilter<"User"> | string
    password?: StringWithAggregatesFilter<"User"> | string
    role?: EnumRoleWithAggregatesFilter<"User"> | $Enums.Role
    hospitalId?: IntWithAggregatesFilter<"User"> | number
  }

  export type PatientWhereInput = {
    AND?: PatientWhereInput | PatientWhereInput[]
    OR?: PatientWhereInput[]
    NOT?: PatientWhereInput | PatientWhereInput[]
    id?: IntFilter<"Patient"> | number
    displayName?: StringFilter<"Patient"> | string
    phone?: StringNullableFilter<"Patient"> | string | null
    encounters?: EncounterListRelationFilter
  }

  export type PatientOrderByWithRelationInput = {
    id?: SortOrder
    displayName?: SortOrder
    phone?: SortOrderInput | SortOrder
    encounters?: EncounterOrderByRelationAggregateInput
  }

  export type PatientWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: PatientWhereInput | PatientWhereInput[]
    OR?: PatientWhereInput[]
    NOT?: PatientWhereInput | PatientWhereInput[]
    displayName?: StringFilter<"Patient"> | string
    phone?: StringNullableFilter<"Patient"> | string | null
    encounters?: EncounterListRelationFilter
  }, "id">

  export type PatientOrderByWithAggregationInput = {
    id?: SortOrder
    displayName?: SortOrder
    phone?: SortOrderInput | SortOrder
    _count?: PatientCountOrderByAggregateInput
    _avg?: PatientAvgOrderByAggregateInput
    _max?: PatientMaxOrderByAggregateInput
    _min?: PatientMinOrderByAggregateInput
    _sum?: PatientSumOrderByAggregateInput
  }

  export type PatientScalarWhereWithAggregatesInput = {
    AND?: PatientScalarWhereWithAggregatesInput | PatientScalarWhereWithAggregatesInput[]
    OR?: PatientScalarWhereWithAggregatesInput[]
    NOT?: PatientScalarWhereWithAggregatesInput | PatientScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Patient"> | number
    displayName?: StringWithAggregatesFilter<"Patient"> | string
    phone?: StringNullableWithAggregatesFilter<"Patient"> | string | null
  }

  export type EncounterWhereInput = {
    AND?: EncounterWhereInput | EncounterWhereInput[]
    OR?: EncounterWhereInput[]
    NOT?: EncounterWhereInput | EncounterWhereInput[]
    id?: IntFilter<"Encounter"> | number
    createdAt?: DateTimeFilter<"Encounter"> | Date | string
    updatedAt?: DateTimeFilter<"Encounter"> | Date | string
    status?: EnumEncounterStatusFilter<"Encounter"> | $Enums.EncounterStatus
    hospitalName?: StringFilter<"Encounter"> | string
    chiefComplaint?: StringFilter<"Encounter"> | string
    details?: StringNullableFilter<"Encounter"> | string | null
    hospitalId?: IntNullableFilter<"Encounter"> | number | null
    patientId?: IntFilter<"Encounter"> | number
    hospital?: XOR<HospitalNullableScalarRelationFilter, HospitalWhereInput> | null
    patient?: XOR<PatientScalarRelationFilter, PatientWhereInput>
    triageNotes?: TriageNoteListRelationFilter
    messages?: MessageListRelationFilter
  }

  export type EncounterOrderByWithRelationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    status?: SortOrder
    hospitalName?: SortOrder
    chiefComplaint?: SortOrder
    details?: SortOrderInput | SortOrder
    hospitalId?: SortOrderInput | SortOrder
    patientId?: SortOrder
    hospital?: HospitalOrderByWithRelationInput
    patient?: PatientOrderByWithRelationInput
    triageNotes?: TriageNoteOrderByRelationAggregateInput
    messages?: MessageOrderByRelationAggregateInput
  }

  export type EncounterWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: EncounterWhereInput | EncounterWhereInput[]
    OR?: EncounterWhereInput[]
    NOT?: EncounterWhereInput | EncounterWhereInput[]
    createdAt?: DateTimeFilter<"Encounter"> | Date | string
    updatedAt?: DateTimeFilter<"Encounter"> | Date | string
    status?: EnumEncounterStatusFilter<"Encounter"> | $Enums.EncounterStatus
    hospitalName?: StringFilter<"Encounter"> | string
    chiefComplaint?: StringFilter<"Encounter"> | string
    details?: StringNullableFilter<"Encounter"> | string | null
    hospitalId?: IntNullableFilter<"Encounter"> | number | null
    patientId?: IntFilter<"Encounter"> | number
    hospital?: XOR<HospitalNullableScalarRelationFilter, HospitalWhereInput> | null
    patient?: XOR<PatientScalarRelationFilter, PatientWhereInput>
    triageNotes?: TriageNoteListRelationFilter
    messages?: MessageListRelationFilter
  }, "id">

  export type EncounterOrderByWithAggregationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    status?: SortOrder
    hospitalName?: SortOrder
    chiefComplaint?: SortOrder
    details?: SortOrderInput | SortOrder
    hospitalId?: SortOrderInput | SortOrder
    patientId?: SortOrder
    _count?: EncounterCountOrderByAggregateInput
    _avg?: EncounterAvgOrderByAggregateInput
    _max?: EncounterMaxOrderByAggregateInput
    _min?: EncounterMinOrderByAggregateInput
    _sum?: EncounterSumOrderByAggregateInput
  }

  export type EncounterScalarWhereWithAggregatesInput = {
    AND?: EncounterScalarWhereWithAggregatesInput | EncounterScalarWhereWithAggregatesInput[]
    OR?: EncounterScalarWhereWithAggregatesInput[]
    NOT?: EncounterScalarWhereWithAggregatesInput | EncounterScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Encounter"> | number
    createdAt?: DateTimeWithAggregatesFilter<"Encounter"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Encounter"> | Date | string
    status?: EnumEncounterStatusWithAggregatesFilter<"Encounter"> | $Enums.EncounterStatus
    hospitalName?: StringWithAggregatesFilter<"Encounter"> | string
    chiefComplaint?: StringWithAggregatesFilter<"Encounter"> | string
    details?: StringNullableWithAggregatesFilter<"Encounter"> | string | null
    hospitalId?: IntNullableWithAggregatesFilter<"Encounter"> | number | null
    patientId?: IntWithAggregatesFilter<"Encounter"> | number
  }

  export type TriageNoteWhereInput = {
    AND?: TriageNoteWhereInput | TriageNoteWhereInput[]
    OR?: TriageNoteWhereInput[]
    NOT?: TriageNoteWhereInput | TriageNoteWhereInput[]
    id?: IntFilter<"TriageNote"> | number
    createdAt?: DateTimeFilter<"TriageNote"> | Date | string
    note?: StringFilter<"TriageNote"> | string
    userId?: IntNullableFilter<"TriageNote"> | number | null
    encounterId?: IntFilter<"TriageNote"> | number
    createdBy?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    encounter?: XOR<EncounterScalarRelationFilter, EncounterWhereInput>
  }

  export type TriageNoteOrderByWithRelationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    note?: SortOrder
    userId?: SortOrderInput | SortOrder
    encounterId?: SortOrder
    createdBy?: UserOrderByWithRelationInput
    encounter?: EncounterOrderByWithRelationInput
  }

  export type TriageNoteWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: TriageNoteWhereInput | TriageNoteWhereInput[]
    OR?: TriageNoteWhereInput[]
    NOT?: TriageNoteWhereInput | TriageNoteWhereInput[]
    createdAt?: DateTimeFilter<"TriageNote"> | Date | string
    note?: StringFilter<"TriageNote"> | string
    userId?: IntNullableFilter<"TriageNote"> | number | null
    encounterId?: IntFilter<"TriageNote"> | number
    createdBy?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
    encounter?: XOR<EncounterScalarRelationFilter, EncounterWhereInput>
  }, "id">

  export type TriageNoteOrderByWithAggregationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    note?: SortOrder
    userId?: SortOrderInput | SortOrder
    encounterId?: SortOrder
    _count?: TriageNoteCountOrderByAggregateInput
    _avg?: TriageNoteAvgOrderByAggregateInput
    _max?: TriageNoteMaxOrderByAggregateInput
    _min?: TriageNoteMinOrderByAggregateInput
    _sum?: TriageNoteSumOrderByAggregateInput
  }

  export type TriageNoteScalarWhereWithAggregatesInput = {
    AND?: TriageNoteScalarWhereWithAggregatesInput | TriageNoteScalarWhereWithAggregatesInput[]
    OR?: TriageNoteScalarWhereWithAggregatesInput[]
    NOT?: TriageNoteScalarWhereWithAggregatesInput | TriageNoteScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"TriageNote"> | number
    createdAt?: DateTimeWithAggregatesFilter<"TriageNote"> | Date | string
    note?: StringWithAggregatesFilter<"TriageNote"> | string
    userId?: IntNullableWithAggregatesFilter<"TriageNote"> | number | null
    encounterId?: IntWithAggregatesFilter<"TriageNote"> | number
  }

  export type MessageWhereInput = {
    AND?: MessageWhereInput | MessageWhereInput[]
    OR?: MessageWhereInput[]
    NOT?: MessageWhereInput | MessageWhereInput[]
    id?: IntFilter<"Message"> | number
    createdAt?: DateTimeFilter<"Message"> | Date | string
    from?: EnumMessageAuthorFilter<"Message"> | $Enums.MessageAuthor
    content?: StringFilter<"Message"> | string
    encounterId?: IntFilter<"Message"> | number
    encounter?: XOR<EncounterScalarRelationFilter, EncounterWhereInput>
  }

  export type MessageOrderByWithRelationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    from?: SortOrder
    content?: SortOrder
    encounterId?: SortOrder
    encounter?: EncounterOrderByWithRelationInput
  }

  export type MessageWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: MessageWhereInput | MessageWhereInput[]
    OR?: MessageWhereInput[]
    NOT?: MessageWhereInput | MessageWhereInput[]
    createdAt?: DateTimeFilter<"Message"> | Date | string
    from?: EnumMessageAuthorFilter<"Message"> | $Enums.MessageAuthor
    content?: StringFilter<"Message"> | string
    encounterId?: IntFilter<"Message"> | number
    encounter?: XOR<EncounterScalarRelationFilter, EncounterWhereInput>
  }, "id">

  export type MessageOrderByWithAggregationInput = {
    id?: SortOrder
    createdAt?: SortOrder
    from?: SortOrder
    content?: SortOrder
    encounterId?: SortOrder
    _count?: MessageCountOrderByAggregateInput
    _avg?: MessageAvgOrderByAggregateInput
    _max?: MessageMaxOrderByAggregateInput
    _min?: MessageMinOrderByAggregateInput
    _sum?: MessageSumOrderByAggregateInput
  }

  export type MessageScalarWhereWithAggregatesInput = {
    AND?: MessageScalarWhereWithAggregatesInput | MessageScalarWhereWithAggregatesInput[]
    OR?: MessageScalarWhereWithAggregatesInput[]
    NOT?: MessageScalarWhereWithAggregatesInput | MessageScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Message"> | number
    createdAt?: DateTimeWithAggregatesFilter<"Message"> | Date | string
    from?: EnumMessageAuthorWithAggregatesFilter<"Message"> | $Enums.MessageAuthor
    content?: StringWithAggregatesFilter<"Message"> | string
    encounterId?: IntWithAggregatesFilter<"Message"> | number
  }

  export type HospitalCreateInput = {
    name: string
    slug: string
    encounters?: EncounterCreateNestedManyWithoutHospitalInput
    users?: UserCreateNestedManyWithoutHospitalInput
  }

  export type HospitalUncheckedCreateInput = {
    id?: number
    name: string
    slug: string
    encounters?: EncounterUncheckedCreateNestedManyWithoutHospitalInput
    users?: UserUncheckedCreateNestedManyWithoutHospitalInput
  }

  export type HospitalUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    encounters?: EncounterUpdateManyWithoutHospitalNestedInput
    users?: UserUpdateManyWithoutHospitalNestedInput
  }

  export type HospitalUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    encounters?: EncounterUncheckedUpdateManyWithoutHospitalNestedInput
    users?: UserUncheckedUpdateManyWithoutHospitalNestedInput
  }

  export type HospitalCreateManyInput = {
    id?: number
    name: string
    slug: string
  }

  export type HospitalUpdateManyMutationInput = {
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
  }

  export type HospitalUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
  }

  export type UserCreateInput = {
    email: string
    password: string
    role: $Enums.Role
    hospital: HospitalCreateNestedOneWithoutUsersInput
    triageNotes?: TriageNoteCreateNestedManyWithoutCreatedByInput
  }

  export type UserUncheckedCreateInput = {
    id?: number
    email: string
    password: string
    role: $Enums.Role
    hospitalId: number
    triageNotes?: TriageNoteUncheckedCreateNestedManyWithoutCreatedByInput
  }

  export type UserUpdateInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    hospital?: HospitalUpdateOneRequiredWithoutUsersNestedInput
    triageNotes?: TriageNoteUpdateManyWithoutCreatedByNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    hospitalId?: IntFieldUpdateOperationsInput | number
    triageNotes?: TriageNoteUncheckedUpdateManyWithoutCreatedByNestedInput
  }

  export type UserCreateManyInput = {
    id?: number
    email: string
    password: string
    role: $Enums.Role
    hospitalId: number
  }

  export type UserUpdateManyMutationInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
  }

  export type UserUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    hospitalId?: IntFieldUpdateOperationsInput | number
  }

  export type PatientCreateInput = {
    displayName: string
    phone?: string | null
    encounters?: EncounterCreateNestedManyWithoutPatientInput
  }

  export type PatientUncheckedCreateInput = {
    id?: number
    displayName: string
    phone?: string | null
    encounters?: EncounterUncheckedCreateNestedManyWithoutPatientInput
  }

  export type PatientUpdateInput = {
    displayName?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    encounters?: EncounterUpdateManyWithoutPatientNestedInput
  }

  export type PatientUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    displayName?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    encounters?: EncounterUncheckedUpdateManyWithoutPatientNestedInput
  }

  export type PatientCreateManyInput = {
    id?: number
    displayName: string
    phone?: string | null
  }

  export type PatientUpdateManyMutationInput = {
    displayName?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PatientUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    displayName?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type EncounterCreateInput = {
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospital?: HospitalCreateNestedOneWithoutEncountersInput
    patient: PatientCreateNestedOneWithoutEncountersInput
    triageNotes?: TriageNoteCreateNestedManyWithoutEncounterInput
    messages?: MessageCreateNestedManyWithoutEncounterInput
  }

  export type EncounterUncheckedCreateInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospitalId?: number | null
    patientId: number
    triageNotes?: TriageNoteUncheckedCreateNestedManyWithoutEncounterInput
    messages?: MessageUncheckedCreateNestedManyWithoutEncounterInput
  }

  export type EncounterUpdateInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospital?: HospitalUpdateOneWithoutEncountersNestedInput
    patient?: PatientUpdateOneRequiredWithoutEncountersNestedInput
    triageNotes?: TriageNoteUpdateManyWithoutEncounterNestedInput
    messages?: MessageUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospitalId?: NullableIntFieldUpdateOperationsInput | number | null
    patientId?: IntFieldUpdateOperationsInput | number
    triageNotes?: TriageNoteUncheckedUpdateManyWithoutEncounterNestedInput
    messages?: MessageUncheckedUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterCreateManyInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospitalId?: number | null
    patientId: number
  }

  export type EncounterUpdateManyMutationInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type EncounterUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospitalId?: NullableIntFieldUpdateOperationsInput | number | null
    patientId?: IntFieldUpdateOperationsInput | number
  }

  export type TriageNoteCreateInput = {
    createdAt?: Date | string
    note: string
    createdBy?: UserCreateNestedOneWithoutTriageNotesInput
    encounter: EncounterCreateNestedOneWithoutTriageNotesInput
  }

  export type TriageNoteUncheckedCreateInput = {
    id?: number
    createdAt?: Date | string
    note: string
    userId?: number | null
    encounterId: number
  }

  export type TriageNoteUpdateInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    createdBy?: UserUpdateOneWithoutTriageNotesNestedInput
    encounter?: EncounterUpdateOneRequiredWithoutTriageNotesNestedInput
  }

  export type TriageNoteUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    userId?: NullableIntFieldUpdateOperationsInput | number | null
    encounterId?: IntFieldUpdateOperationsInput | number
  }

  export type TriageNoteCreateManyInput = {
    id?: number
    createdAt?: Date | string
    note: string
    userId?: number | null
    encounterId: number
  }

  export type TriageNoteUpdateManyMutationInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
  }

  export type TriageNoteUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    userId?: NullableIntFieldUpdateOperationsInput | number | null
    encounterId?: IntFieldUpdateOperationsInput | number
  }

  export type MessageCreateInput = {
    createdAt?: Date | string
    from: $Enums.MessageAuthor
    content: string
    encounter: EncounterCreateNestedOneWithoutMessagesInput
  }

  export type MessageUncheckedCreateInput = {
    id?: number
    createdAt?: Date | string
    from: $Enums.MessageAuthor
    content: string
    encounterId: number
  }

  export type MessageUpdateInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    from?: EnumMessageAuthorFieldUpdateOperationsInput | $Enums.MessageAuthor
    content?: StringFieldUpdateOperationsInput | string
    encounter?: EncounterUpdateOneRequiredWithoutMessagesNestedInput
  }

  export type MessageUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    from?: EnumMessageAuthorFieldUpdateOperationsInput | $Enums.MessageAuthor
    content?: StringFieldUpdateOperationsInput | string
    encounterId?: IntFieldUpdateOperationsInput | number
  }

  export type MessageCreateManyInput = {
    id?: number
    createdAt?: Date | string
    from: $Enums.MessageAuthor
    content: string
    encounterId: number
  }

  export type MessageUpdateManyMutationInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    from?: EnumMessageAuthorFieldUpdateOperationsInput | $Enums.MessageAuthor
    content?: StringFieldUpdateOperationsInput | string
  }

  export type MessageUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    from?: EnumMessageAuthorFieldUpdateOperationsInput | $Enums.MessageAuthor
    content?: StringFieldUpdateOperationsInput | string
    encounterId?: IntFieldUpdateOperationsInput | number
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type EncounterListRelationFilter = {
    every?: EncounterWhereInput
    some?: EncounterWhereInput
    none?: EncounterWhereInput
  }

  export type UserListRelationFilter = {
    every?: UserWhereInput
    some?: UserWhereInput
    none?: UserWhereInput
  }

  export type EncounterOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type HospitalCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
  }

  export type HospitalAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type HospitalMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
  }

  export type HospitalMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    slug?: SortOrder
  }

  export type HospitalSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type EnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role
  }

  export type HospitalScalarRelationFilter = {
    is?: HospitalWhereInput
    isNot?: HospitalWhereInput
  }

  export type TriageNoteListRelationFilter = {
    every?: TriageNoteWhereInput
    some?: TriageNoteWhereInput
    none?: TriageNoteWhereInput
  }

  export type TriageNoteOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    hospitalId?: SortOrder
  }

  export type UserAvgOrderByAggregateInput = {
    id?: SortOrder
    hospitalId?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    hospitalId?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    password?: SortOrder
    role?: SortOrder
    hospitalId?: SortOrder
  }

  export type UserSumOrderByAggregateInput = {
    id?: SortOrder
    hospitalId?: SortOrder
  }

  export type EnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type PatientCountOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    phone?: SortOrder
  }

  export type PatientAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type PatientMaxOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    phone?: SortOrder
  }

  export type PatientMinOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    phone?: SortOrder
  }

  export type PatientSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type EnumEncounterStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.EncounterStatus | EnumEncounterStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEncounterStatusFilter<$PrismaModel> | $Enums.EncounterStatus
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type HospitalNullableScalarRelationFilter = {
    is?: HospitalWhereInput | null
    isNot?: HospitalWhereInput | null
  }

  export type PatientScalarRelationFilter = {
    is?: PatientWhereInput
    isNot?: PatientWhereInput
  }

  export type MessageListRelationFilter = {
    every?: MessageWhereInput
    some?: MessageWhereInput
    none?: MessageWhereInput
  }

  export type MessageOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type EncounterCountOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    status?: SortOrder
    hospitalName?: SortOrder
    chiefComplaint?: SortOrder
    details?: SortOrder
    hospitalId?: SortOrder
    patientId?: SortOrder
  }

  export type EncounterAvgOrderByAggregateInput = {
    id?: SortOrder
    hospitalId?: SortOrder
    patientId?: SortOrder
  }

  export type EncounterMaxOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    status?: SortOrder
    hospitalName?: SortOrder
    chiefComplaint?: SortOrder
    details?: SortOrder
    hospitalId?: SortOrder
    patientId?: SortOrder
  }

  export type EncounterMinOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    status?: SortOrder
    hospitalName?: SortOrder
    chiefComplaint?: SortOrder
    details?: SortOrder
    hospitalId?: SortOrder
    patientId?: SortOrder
  }

  export type EncounterSumOrderByAggregateInput = {
    id?: SortOrder
    hospitalId?: SortOrder
    patientId?: SortOrder
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type EnumEncounterStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EncounterStatus | EnumEncounterStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEncounterStatusWithAggregatesFilter<$PrismaModel> | $Enums.EncounterStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEncounterStatusFilter<$PrismaModel>
    _max?: NestedEnumEncounterStatusFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type EncounterScalarRelationFilter = {
    is?: EncounterWhereInput
    isNot?: EncounterWhereInput
  }

  export type TriageNoteCountOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    note?: SortOrder
    userId?: SortOrder
    encounterId?: SortOrder
  }

  export type TriageNoteAvgOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    encounterId?: SortOrder
  }

  export type TriageNoteMaxOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    note?: SortOrder
    userId?: SortOrder
    encounterId?: SortOrder
  }

  export type TriageNoteMinOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    note?: SortOrder
    userId?: SortOrder
    encounterId?: SortOrder
  }

  export type TriageNoteSumOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    encounterId?: SortOrder
  }

  export type EnumMessageAuthorFilter<$PrismaModel = never> = {
    equals?: $Enums.MessageAuthor | EnumMessageAuthorFieldRefInput<$PrismaModel>
    in?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    notIn?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    not?: NestedEnumMessageAuthorFilter<$PrismaModel> | $Enums.MessageAuthor
  }

  export type MessageCountOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    from?: SortOrder
    content?: SortOrder
    encounterId?: SortOrder
  }

  export type MessageAvgOrderByAggregateInput = {
    id?: SortOrder
    encounterId?: SortOrder
  }

  export type MessageMaxOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    from?: SortOrder
    content?: SortOrder
    encounterId?: SortOrder
  }

  export type MessageMinOrderByAggregateInput = {
    id?: SortOrder
    createdAt?: SortOrder
    from?: SortOrder
    content?: SortOrder
    encounterId?: SortOrder
  }

  export type MessageSumOrderByAggregateInput = {
    id?: SortOrder
    encounterId?: SortOrder
  }

  export type EnumMessageAuthorWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MessageAuthor | EnumMessageAuthorFieldRefInput<$PrismaModel>
    in?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    notIn?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    not?: NestedEnumMessageAuthorWithAggregatesFilter<$PrismaModel> | $Enums.MessageAuthor
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumMessageAuthorFilter<$PrismaModel>
    _max?: NestedEnumMessageAuthorFilter<$PrismaModel>
  }

  export type EncounterCreateNestedManyWithoutHospitalInput = {
    create?: XOR<EncounterCreateWithoutHospitalInput, EncounterUncheckedCreateWithoutHospitalInput> | EncounterCreateWithoutHospitalInput[] | EncounterUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutHospitalInput | EncounterCreateOrConnectWithoutHospitalInput[]
    createMany?: EncounterCreateManyHospitalInputEnvelope
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
  }

  export type UserCreateNestedManyWithoutHospitalInput = {
    create?: XOR<UserCreateWithoutHospitalInput, UserUncheckedCreateWithoutHospitalInput> | UserCreateWithoutHospitalInput[] | UserUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: UserCreateOrConnectWithoutHospitalInput | UserCreateOrConnectWithoutHospitalInput[]
    createMany?: UserCreateManyHospitalInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type EncounterUncheckedCreateNestedManyWithoutHospitalInput = {
    create?: XOR<EncounterCreateWithoutHospitalInput, EncounterUncheckedCreateWithoutHospitalInput> | EncounterCreateWithoutHospitalInput[] | EncounterUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutHospitalInput | EncounterCreateOrConnectWithoutHospitalInput[]
    createMany?: EncounterCreateManyHospitalInputEnvelope
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
  }

  export type UserUncheckedCreateNestedManyWithoutHospitalInput = {
    create?: XOR<UserCreateWithoutHospitalInput, UserUncheckedCreateWithoutHospitalInput> | UserCreateWithoutHospitalInput[] | UserUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: UserCreateOrConnectWithoutHospitalInput | UserCreateOrConnectWithoutHospitalInput[]
    createMany?: UserCreateManyHospitalInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type EncounterUpdateManyWithoutHospitalNestedInput = {
    create?: XOR<EncounterCreateWithoutHospitalInput, EncounterUncheckedCreateWithoutHospitalInput> | EncounterCreateWithoutHospitalInput[] | EncounterUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutHospitalInput | EncounterCreateOrConnectWithoutHospitalInput[]
    upsert?: EncounterUpsertWithWhereUniqueWithoutHospitalInput | EncounterUpsertWithWhereUniqueWithoutHospitalInput[]
    createMany?: EncounterCreateManyHospitalInputEnvelope
    set?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    disconnect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    delete?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    update?: EncounterUpdateWithWhereUniqueWithoutHospitalInput | EncounterUpdateWithWhereUniqueWithoutHospitalInput[]
    updateMany?: EncounterUpdateManyWithWhereWithoutHospitalInput | EncounterUpdateManyWithWhereWithoutHospitalInput[]
    deleteMany?: EncounterScalarWhereInput | EncounterScalarWhereInput[]
  }

  export type UserUpdateManyWithoutHospitalNestedInput = {
    create?: XOR<UserCreateWithoutHospitalInput, UserUncheckedCreateWithoutHospitalInput> | UserCreateWithoutHospitalInput[] | UserUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: UserCreateOrConnectWithoutHospitalInput | UserCreateOrConnectWithoutHospitalInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutHospitalInput | UserUpsertWithWhereUniqueWithoutHospitalInput[]
    createMany?: UserCreateManyHospitalInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutHospitalInput | UserUpdateWithWhereUniqueWithoutHospitalInput[]
    updateMany?: UserUpdateManyWithWhereWithoutHospitalInput | UserUpdateManyWithWhereWithoutHospitalInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type EncounterUncheckedUpdateManyWithoutHospitalNestedInput = {
    create?: XOR<EncounterCreateWithoutHospitalInput, EncounterUncheckedCreateWithoutHospitalInput> | EncounterCreateWithoutHospitalInput[] | EncounterUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutHospitalInput | EncounterCreateOrConnectWithoutHospitalInput[]
    upsert?: EncounterUpsertWithWhereUniqueWithoutHospitalInput | EncounterUpsertWithWhereUniqueWithoutHospitalInput[]
    createMany?: EncounterCreateManyHospitalInputEnvelope
    set?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    disconnect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    delete?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    update?: EncounterUpdateWithWhereUniqueWithoutHospitalInput | EncounterUpdateWithWhereUniqueWithoutHospitalInput[]
    updateMany?: EncounterUpdateManyWithWhereWithoutHospitalInput | EncounterUpdateManyWithWhereWithoutHospitalInput[]
    deleteMany?: EncounterScalarWhereInput | EncounterScalarWhereInput[]
  }

  export type UserUncheckedUpdateManyWithoutHospitalNestedInput = {
    create?: XOR<UserCreateWithoutHospitalInput, UserUncheckedCreateWithoutHospitalInput> | UserCreateWithoutHospitalInput[] | UserUncheckedCreateWithoutHospitalInput[]
    connectOrCreate?: UserCreateOrConnectWithoutHospitalInput | UserCreateOrConnectWithoutHospitalInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutHospitalInput | UserUpsertWithWhereUniqueWithoutHospitalInput[]
    createMany?: UserCreateManyHospitalInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutHospitalInput | UserUpdateWithWhereUniqueWithoutHospitalInput[]
    updateMany?: UserUpdateManyWithWhereWithoutHospitalInput | UserUpdateManyWithWhereWithoutHospitalInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type HospitalCreateNestedOneWithoutUsersInput = {
    create?: XOR<HospitalCreateWithoutUsersInput, HospitalUncheckedCreateWithoutUsersInput>
    connectOrCreate?: HospitalCreateOrConnectWithoutUsersInput
    connect?: HospitalWhereUniqueInput
  }

  export type TriageNoteCreateNestedManyWithoutCreatedByInput = {
    create?: XOR<TriageNoteCreateWithoutCreatedByInput, TriageNoteUncheckedCreateWithoutCreatedByInput> | TriageNoteCreateWithoutCreatedByInput[] | TriageNoteUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutCreatedByInput | TriageNoteCreateOrConnectWithoutCreatedByInput[]
    createMany?: TriageNoteCreateManyCreatedByInputEnvelope
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
  }

  export type TriageNoteUncheckedCreateNestedManyWithoutCreatedByInput = {
    create?: XOR<TriageNoteCreateWithoutCreatedByInput, TriageNoteUncheckedCreateWithoutCreatedByInput> | TriageNoteCreateWithoutCreatedByInput[] | TriageNoteUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutCreatedByInput | TriageNoteCreateOrConnectWithoutCreatedByInput[]
    createMany?: TriageNoteCreateManyCreatedByInputEnvelope
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
  }

  export type EnumRoleFieldUpdateOperationsInput = {
    set?: $Enums.Role
  }

  export type HospitalUpdateOneRequiredWithoutUsersNestedInput = {
    create?: XOR<HospitalCreateWithoutUsersInput, HospitalUncheckedCreateWithoutUsersInput>
    connectOrCreate?: HospitalCreateOrConnectWithoutUsersInput
    upsert?: HospitalUpsertWithoutUsersInput
    connect?: HospitalWhereUniqueInput
    update?: XOR<XOR<HospitalUpdateToOneWithWhereWithoutUsersInput, HospitalUpdateWithoutUsersInput>, HospitalUncheckedUpdateWithoutUsersInput>
  }

  export type TriageNoteUpdateManyWithoutCreatedByNestedInput = {
    create?: XOR<TriageNoteCreateWithoutCreatedByInput, TriageNoteUncheckedCreateWithoutCreatedByInput> | TriageNoteCreateWithoutCreatedByInput[] | TriageNoteUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutCreatedByInput | TriageNoteCreateOrConnectWithoutCreatedByInput[]
    upsert?: TriageNoteUpsertWithWhereUniqueWithoutCreatedByInput | TriageNoteUpsertWithWhereUniqueWithoutCreatedByInput[]
    createMany?: TriageNoteCreateManyCreatedByInputEnvelope
    set?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    disconnect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    delete?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    update?: TriageNoteUpdateWithWhereUniqueWithoutCreatedByInput | TriageNoteUpdateWithWhereUniqueWithoutCreatedByInput[]
    updateMany?: TriageNoteUpdateManyWithWhereWithoutCreatedByInput | TriageNoteUpdateManyWithWhereWithoutCreatedByInput[]
    deleteMany?: TriageNoteScalarWhereInput | TriageNoteScalarWhereInput[]
  }

  export type TriageNoteUncheckedUpdateManyWithoutCreatedByNestedInput = {
    create?: XOR<TriageNoteCreateWithoutCreatedByInput, TriageNoteUncheckedCreateWithoutCreatedByInput> | TriageNoteCreateWithoutCreatedByInput[] | TriageNoteUncheckedCreateWithoutCreatedByInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutCreatedByInput | TriageNoteCreateOrConnectWithoutCreatedByInput[]
    upsert?: TriageNoteUpsertWithWhereUniqueWithoutCreatedByInput | TriageNoteUpsertWithWhereUniqueWithoutCreatedByInput[]
    createMany?: TriageNoteCreateManyCreatedByInputEnvelope
    set?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    disconnect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    delete?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    update?: TriageNoteUpdateWithWhereUniqueWithoutCreatedByInput | TriageNoteUpdateWithWhereUniqueWithoutCreatedByInput[]
    updateMany?: TriageNoteUpdateManyWithWhereWithoutCreatedByInput | TriageNoteUpdateManyWithWhereWithoutCreatedByInput[]
    deleteMany?: TriageNoteScalarWhereInput | TriageNoteScalarWhereInput[]
  }

  export type EncounterCreateNestedManyWithoutPatientInput = {
    create?: XOR<EncounterCreateWithoutPatientInput, EncounterUncheckedCreateWithoutPatientInput> | EncounterCreateWithoutPatientInput[] | EncounterUncheckedCreateWithoutPatientInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutPatientInput | EncounterCreateOrConnectWithoutPatientInput[]
    createMany?: EncounterCreateManyPatientInputEnvelope
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
  }

  export type EncounterUncheckedCreateNestedManyWithoutPatientInput = {
    create?: XOR<EncounterCreateWithoutPatientInput, EncounterUncheckedCreateWithoutPatientInput> | EncounterCreateWithoutPatientInput[] | EncounterUncheckedCreateWithoutPatientInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutPatientInput | EncounterCreateOrConnectWithoutPatientInput[]
    createMany?: EncounterCreateManyPatientInputEnvelope
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EncounterUpdateManyWithoutPatientNestedInput = {
    create?: XOR<EncounterCreateWithoutPatientInput, EncounterUncheckedCreateWithoutPatientInput> | EncounterCreateWithoutPatientInput[] | EncounterUncheckedCreateWithoutPatientInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutPatientInput | EncounterCreateOrConnectWithoutPatientInput[]
    upsert?: EncounterUpsertWithWhereUniqueWithoutPatientInput | EncounterUpsertWithWhereUniqueWithoutPatientInput[]
    createMany?: EncounterCreateManyPatientInputEnvelope
    set?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    disconnect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    delete?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    update?: EncounterUpdateWithWhereUniqueWithoutPatientInput | EncounterUpdateWithWhereUniqueWithoutPatientInput[]
    updateMany?: EncounterUpdateManyWithWhereWithoutPatientInput | EncounterUpdateManyWithWhereWithoutPatientInput[]
    deleteMany?: EncounterScalarWhereInput | EncounterScalarWhereInput[]
  }

  export type EncounterUncheckedUpdateManyWithoutPatientNestedInput = {
    create?: XOR<EncounterCreateWithoutPatientInput, EncounterUncheckedCreateWithoutPatientInput> | EncounterCreateWithoutPatientInput[] | EncounterUncheckedCreateWithoutPatientInput[]
    connectOrCreate?: EncounterCreateOrConnectWithoutPatientInput | EncounterCreateOrConnectWithoutPatientInput[]
    upsert?: EncounterUpsertWithWhereUniqueWithoutPatientInput | EncounterUpsertWithWhereUniqueWithoutPatientInput[]
    createMany?: EncounterCreateManyPatientInputEnvelope
    set?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    disconnect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    delete?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    connect?: EncounterWhereUniqueInput | EncounterWhereUniqueInput[]
    update?: EncounterUpdateWithWhereUniqueWithoutPatientInput | EncounterUpdateWithWhereUniqueWithoutPatientInput[]
    updateMany?: EncounterUpdateManyWithWhereWithoutPatientInput | EncounterUpdateManyWithWhereWithoutPatientInput[]
    deleteMany?: EncounterScalarWhereInput | EncounterScalarWhereInput[]
  }

  export type HospitalCreateNestedOneWithoutEncountersInput = {
    create?: XOR<HospitalCreateWithoutEncountersInput, HospitalUncheckedCreateWithoutEncountersInput>
    connectOrCreate?: HospitalCreateOrConnectWithoutEncountersInput
    connect?: HospitalWhereUniqueInput
  }

  export type PatientCreateNestedOneWithoutEncountersInput = {
    create?: XOR<PatientCreateWithoutEncountersInput, PatientUncheckedCreateWithoutEncountersInput>
    connectOrCreate?: PatientCreateOrConnectWithoutEncountersInput
    connect?: PatientWhereUniqueInput
  }

  export type TriageNoteCreateNestedManyWithoutEncounterInput = {
    create?: XOR<TriageNoteCreateWithoutEncounterInput, TriageNoteUncheckedCreateWithoutEncounterInput> | TriageNoteCreateWithoutEncounterInput[] | TriageNoteUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutEncounterInput | TriageNoteCreateOrConnectWithoutEncounterInput[]
    createMany?: TriageNoteCreateManyEncounterInputEnvelope
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
  }

  export type MessageCreateNestedManyWithoutEncounterInput = {
    create?: XOR<MessageCreateWithoutEncounterInput, MessageUncheckedCreateWithoutEncounterInput> | MessageCreateWithoutEncounterInput[] | MessageUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutEncounterInput | MessageCreateOrConnectWithoutEncounterInput[]
    createMany?: MessageCreateManyEncounterInputEnvelope
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
  }

  export type TriageNoteUncheckedCreateNestedManyWithoutEncounterInput = {
    create?: XOR<TriageNoteCreateWithoutEncounterInput, TriageNoteUncheckedCreateWithoutEncounterInput> | TriageNoteCreateWithoutEncounterInput[] | TriageNoteUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutEncounterInput | TriageNoteCreateOrConnectWithoutEncounterInput[]
    createMany?: TriageNoteCreateManyEncounterInputEnvelope
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
  }

  export type MessageUncheckedCreateNestedManyWithoutEncounterInput = {
    create?: XOR<MessageCreateWithoutEncounterInput, MessageUncheckedCreateWithoutEncounterInput> | MessageCreateWithoutEncounterInput[] | MessageUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutEncounterInput | MessageCreateOrConnectWithoutEncounterInput[]
    createMany?: MessageCreateManyEncounterInputEnvelope
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type EnumEncounterStatusFieldUpdateOperationsInput = {
    set?: $Enums.EncounterStatus
  }

  export type HospitalUpdateOneWithoutEncountersNestedInput = {
    create?: XOR<HospitalCreateWithoutEncountersInput, HospitalUncheckedCreateWithoutEncountersInput>
    connectOrCreate?: HospitalCreateOrConnectWithoutEncountersInput
    upsert?: HospitalUpsertWithoutEncountersInput
    disconnect?: HospitalWhereInput | boolean
    delete?: HospitalWhereInput | boolean
    connect?: HospitalWhereUniqueInput
    update?: XOR<XOR<HospitalUpdateToOneWithWhereWithoutEncountersInput, HospitalUpdateWithoutEncountersInput>, HospitalUncheckedUpdateWithoutEncountersInput>
  }

  export type PatientUpdateOneRequiredWithoutEncountersNestedInput = {
    create?: XOR<PatientCreateWithoutEncountersInput, PatientUncheckedCreateWithoutEncountersInput>
    connectOrCreate?: PatientCreateOrConnectWithoutEncountersInput
    upsert?: PatientUpsertWithoutEncountersInput
    connect?: PatientWhereUniqueInput
    update?: XOR<XOR<PatientUpdateToOneWithWhereWithoutEncountersInput, PatientUpdateWithoutEncountersInput>, PatientUncheckedUpdateWithoutEncountersInput>
  }

  export type TriageNoteUpdateManyWithoutEncounterNestedInput = {
    create?: XOR<TriageNoteCreateWithoutEncounterInput, TriageNoteUncheckedCreateWithoutEncounterInput> | TriageNoteCreateWithoutEncounterInput[] | TriageNoteUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutEncounterInput | TriageNoteCreateOrConnectWithoutEncounterInput[]
    upsert?: TriageNoteUpsertWithWhereUniqueWithoutEncounterInput | TriageNoteUpsertWithWhereUniqueWithoutEncounterInput[]
    createMany?: TriageNoteCreateManyEncounterInputEnvelope
    set?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    disconnect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    delete?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    update?: TriageNoteUpdateWithWhereUniqueWithoutEncounterInput | TriageNoteUpdateWithWhereUniqueWithoutEncounterInput[]
    updateMany?: TriageNoteUpdateManyWithWhereWithoutEncounterInput | TriageNoteUpdateManyWithWhereWithoutEncounterInput[]
    deleteMany?: TriageNoteScalarWhereInput | TriageNoteScalarWhereInput[]
  }

  export type MessageUpdateManyWithoutEncounterNestedInput = {
    create?: XOR<MessageCreateWithoutEncounterInput, MessageUncheckedCreateWithoutEncounterInput> | MessageCreateWithoutEncounterInput[] | MessageUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutEncounterInput | MessageCreateOrConnectWithoutEncounterInput[]
    upsert?: MessageUpsertWithWhereUniqueWithoutEncounterInput | MessageUpsertWithWhereUniqueWithoutEncounterInput[]
    createMany?: MessageCreateManyEncounterInputEnvelope
    set?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    disconnect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    delete?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    update?: MessageUpdateWithWhereUniqueWithoutEncounterInput | MessageUpdateWithWhereUniqueWithoutEncounterInput[]
    updateMany?: MessageUpdateManyWithWhereWithoutEncounterInput | MessageUpdateManyWithWhereWithoutEncounterInput[]
    deleteMany?: MessageScalarWhereInput | MessageScalarWhereInput[]
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type TriageNoteUncheckedUpdateManyWithoutEncounterNestedInput = {
    create?: XOR<TriageNoteCreateWithoutEncounterInput, TriageNoteUncheckedCreateWithoutEncounterInput> | TriageNoteCreateWithoutEncounterInput[] | TriageNoteUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: TriageNoteCreateOrConnectWithoutEncounterInput | TriageNoteCreateOrConnectWithoutEncounterInput[]
    upsert?: TriageNoteUpsertWithWhereUniqueWithoutEncounterInput | TriageNoteUpsertWithWhereUniqueWithoutEncounterInput[]
    createMany?: TriageNoteCreateManyEncounterInputEnvelope
    set?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    disconnect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    delete?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    connect?: TriageNoteWhereUniqueInput | TriageNoteWhereUniqueInput[]
    update?: TriageNoteUpdateWithWhereUniqueWithoutEncounterInput | TriageNoteUpdateWithWhereUniqueWithoutEncounterInput[]
    updateMany?: TriageNoteUpdateManyWithWhereWithoutEncounterInput | TriageNoteUpdateManyWithWhereWithoutEncounterInput[]
    deleteMany?: TriageNoteScalarWhereInput | TriageNoteScalarWhereInput[]
  }

  export type MessageUncheckedUpdateManyWithoutEncounterNestedInput = {
    create?: XOR<MessageCreateWithoutEncounterInput, MessageUncheckedCreateWithoutEncounterInput> | MessageCreateWithoutEncounterInput[] | MessageUncheckedCreateWithoutEncounterInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutEncounterInput | MessageCreateOrConnectWithoutEncounterInput[]
    upsert?: MessageUpsertWithWhereUniqueWithoutEncounterInput | MessageUpsertWithWhereUniqueWithoutEncounterInput[]
    createMany?: MessageCreateManyEncounterInputEnvelope
    set?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    disconnect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    delete?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    update?: MessageUpdateWithWhereUniqueWithoutEncounterInput | MessageUpdateWithWhereUniqueWithoutEncounterInput[]
    updateMany?: MessageUpdateManyWithWhereWithoutEncounterInput | MessageUpdateManyWithWhereWithoutEncounterInput[]
    deleteMany?: MessageScalarWhereInput | MessageScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutTriageNotesInput = {
    create?: XOR<UserCreateWithoutTriageNotesInput, UserUncheckedCreateWithoutTriageNotesInput>
    connectOrCreate?: UserCreateOrConnectWithoutTriageNotesInput
    connect?: UserWhereUniqueInput
  }

  export type EncounterCreateNestedOneWithoutTriageNotesInput = {
    create?: XOR<EncounterCreateWithoutTriageNotesInput, EncounterUncheckedCreateWithoutTriageNotesInput>
    connectOrCreate?: EncounterCreateOrConnectWithoutTriageNotesInput
    connect?: EncounterWhereUniqueInput
  }

  export type UserUpdateOneWithoutTriageNotesNestedInput = {
    create?: XOR<UserCreateWithoutTriageNotesInput, UserUncheckedCreateWithoutTriageNotesInput>
    connectOrCreate?: UserCreateOrConnectWithoutTriageNotesInput
    upsert?: UserUpsertWithoutTriageNotesInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutTriageNotesInput, UserUpdateWithoutTriageNotesInput>, UserUncheckedUpdateWithoutTriageNotesInput>
  }

  export type EncounterUpdateOneRequiredWithoutTriageNotesNestedInput = {
    create?: XOR<EncounterCreateWithoutTriageNotesInput, EncounterUncheckedCreateWithoutTriageNotesInput>
    connectOrCreate?: EncounterCreateOrConnectWithoutTriageNotesInput
    upsert?: EncounterUpsertWithoutTriageNotesInput
    connect?: EncounterWhereUniqueInput
    update?: XOR<XOR<EncounterUpdateToOneWithWhereWithoutTriageNotesInput, EncounterUpdateWithoutTriageNotesInput>, EncounterUncheckedUpdateWithoutTriageNotesInput>
  }

  export type EncounterCreateNestedOneWithoutMessagesInput = {
    create?: XOR<EncounterCreateWithoutMessagesInput, EncounterUncheckedCreateWithoutMessagesInput>
    connectOrCreate?: EncounterCreateOrConnectWithoutMessagesInput
    connect?: EncounterWhereUniqueInput
  }

  export type EnumMessageAuthorFieldUpdateOperationsInput = {
    set?: $Enums.MessageAuthor
  }

  export type EncounterUpdateOneRequiredWithoutMessagesNestedInput = {
    create?: XOR<EncounterCreateWithoutMessagesInput, EncounterUncheckedCreateWithoutMessagesInput>
    connectOrCreate?: EncounterCreateOrConnectWithoutMessagesInput
    upsert?: EncounterUpsertWithoutMessagesInput
    connect?: EncounterWhereUniqueInput
    update?: XOR<XOR<EncounterUpdateToOneWithWhereWithoutMessagesInput, EncounterUpdateWithoutMessagesInput>, EncounterUncheckedUpdateWithoutMessagesInput>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedEnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role
  }

  export type NestedEnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedEnumEncounterStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.EncounterStatus | EnumEncounterStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEncounterStatusFilter<$PrismaModel> | $Enums.EncounterStatus
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumEncounterStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.EncounterStatus | EnumEncounterStatusFieldRefInput<$PrismaModel>
    in?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.EncounterStatus[] | ListEnumEncounterStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumEncounterStatusWithAggregatesFilter<$PrismaModel> | $Enums.EncounterStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumEncounterStatusFilter<$PrismaModel>
    _max?: NestedEnumEncounterStatusFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumMessageAuthorFilter<$PrismaModel = never> = {
    equals?: $Enums.MessageAuthor | EnumMessageAuthorFieldRefInput<$PrismaModel>
    in?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    notIn?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    not?: NestedEnumMessageAuthorFilter<$PrismaModel> | $Enums.MessageAuthor
  }

  export type NestedEnumMessageAuthorWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.MessageAuthor | EnumMessageAuthorFieldRefInput<$PrismaModel>
    in?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    notIn?: $Enums.MessageAuthor[] | ListEnumMessageAuthorFieldRefInput<$PrismaModel>
    not?: NestedEnumMessageAuthorWithAggregatesFilter<$PrismaModel> | $Enums.MessageAuthor
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumMessageAuthorFilter<$PrismaModel>
    _max?: NestedEnumMessageAuthorFilter<$PrismaModel>
  }

  export type EncounterCreateWithoutHospitalInput = {
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    patient: PatientCreateNestedOneWithoutEncountersInput
    triageNotes?: TriageNoteCreateNestedManyWithoutEncounterInput
    messages?: MessageCreateNestedManyWithoutEncounterInput
  }

  export type EncounterUncheckedCreateWithoutHospitalInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    patientId: number
    triageNotes?: TriageNoteUncheckedCreateNestedManyWithoutEncounterInput
    messages?: MessageUncheckedCreateNestedManyWithoutEncounterInput
  }

  export type EncounterCreateOrConnectWithoutHospitalInput = {
    where: EncounterWhereUniqueInput
    create: XOR<EncounterCreateWithoutHospitalInput, EncounterUncheckedCreateWithoutHospitalInput>
  }

  export type EncounterCreateManyHospitalInputEnvelope = {
    data: EncounterCreateManyHospitalInput | EncounterCreateManyHospitalInput[]
    skipDuplicates?: boolean
  }

  export type UserCreateWithoutHospitalInput = {
    email: string
    password: string
    role: $Enums.Role
    triageNotes?: TriageNoteCreateNestedManyWithoutCreatedByInput
  }

  export type UserUncheckedCreateWithoutHospitalInput = {
    id?: number
    email: string
    password: string
    role: $Enums.Role
    triageNotes?: TriageNoteUncheckedCreateNestedManyWithoutCreatedByInput
  }

  export type UserCreateOrConnectWithoutHospitalInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutHospitalInput, UserUncheckedCreateWithoutHospitalInput>
  }

  export type UserCreateManyHospitalInputEnvelope = {
    data: UserCreateManyHospitalInput | UserCreateManyHospitalInput[]
    skipDuplicates?: boolean
  }

  export type EncounterUpsertWithWhereUniqueWithoutHospitalInput = {
    where: EncounterWhereUniqueInput
    update: XOR<EncounterUpdateWithoutHospitalInput, EncounterUncheckedUpdateWithoutHospitalInput>
    create: XOR<EncounterCreateWithoutHospitalInput, EncounterUncheckedCreateWithoutHospitalInput>
  }

  export type EncounterUpdateWithWhereUniqueWithoutHospitalInput = {
    where: EncounterWhereUniqueInput
    data: XOR<EncounterUpdateWithoutHospitalInput, EncounterUncheckedUpdateWithoutHospitalInput>
  }

  export type EncounterUpdateManyWithWhereWithoutHospitalInput = {
    where: EncounterScalarWhereInput
    data: XOR<EncounterUpdateManyMutationInput, EncounterUncheckedUpdateManyWithoutHospitalInput>
  }

  export type EncounterScalarWhereInput = {
    AND?: EncounterScalarWhereInput | EncounterScalarWhereInput[]
    OR?: EncounterScalarWhereInput[]
    NOT?: EncounterScalarWhereInput | EncounterScalarWhereInput[]
    id?: IntFilter<"Encounter"> | number
    createdAt?: DateTimeFilter<"Encounter"> | Date | string
    updatedAt?: DateTimeFilter<"Encounter"> | Date | string
    status?: EnumEncounterStatusFilter<"Encounter"> | $Enums.EncounterStatus
    hospitalName?: StringFilter<"Encounter"> | string
    chiefComplaint?: StringFilter<"Encounter"> | string
    details?: StringNullableFilter<"Encounter"> | string | null
    hospitalId?: IntNullableFilter<"Encounter"> | number | null
    patientId?: IntFilter<"Encounter"> | number
  }

  export type UserUpsertWithWhereUniqueWithoutHospitalInput = {
    where: UserWhereUniqueInput
    update: XOR<UserUpdateWithoutHospitalInput, UserUncheckedUpdateWithoutHospitalInput>
    create: XOR<UserCreateWithoutHospitalInput, UserUncheckedCreateWithoutHospitalInput>
  }

  export type UserUpdateWithWhereUniqueWithoutHospitalInput = {
    where: UserWhereUniqueInput
    data: XOR<UserUpdateWithoutHospitalInput, UserUncheckedUpdateWithoutHospitalInput>
  }

  export type UserUpdateManyWithWhereWithoutHospitalInput = {
    where: UserScalarWhereInput
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyWithoutHospitalInput>
  }

  export type UserScalarWhereInput = {
    AND?: UserScalarWhereInput | UserScalarWhereInput[]
    OR?: UserScalarWhereInput[]
    NOT?: UserScalarWhereInput | UserScalarWhereInput[]
    id?: IntFilter<"User"> | number
    email?: StringFilter<"User"> | string
    password?: StringFilter<"User"> | string
    role?: EnumRoleFilter<"User"> | $Enums.Role
    hospitalId?: IntFilter<"User"> | number
  }

  export type HospitalCreateWithoutUsersInput = {
    name: string
    slug: string
    encounters?: EncounterCreateNestedManyWithoutHospitalInput
  }

  export type HospitalUncheckedCreateWithoutUsersInput = {
    id?: number
    name: string
    slug: string
    encounters?: EncounterUncheckedCreateNestedManyWithoutHospitalInput
  }

  export type HospitalCreateOrConnectWithoutUsersInput = {
    where: HospitalWhereUniqueInput
    create: XOR<HospitalCreateWithoutUsersInput, HospitalUncheckedCreateWithoutUsersInput>
  }

  export type TriageNoteCreateWithoutCreatedByInput = {
    createdAt?: Date | string
    note: string
    encounter: EncounterCreateNestedOneWithoutTriageNotesInput
  }

  export type TriageNoteUncheckedCreateWithoutCreatedByInput = {
    id?: number
    createdAt?: Date | string
    note: string
    encounterId: number
  }

  export type TriageNoteCreateOrConnectWithoutCreatedByInput = {
    where: TriageNoteWhereUniqueInput
    create: XOR<TriageNoteCreateWithoutCreatedByInput, TriageNoteUncheckedCreateWithoutCreatedByInput>
  }

  export type TriageNoteCreateManyCreatedByInputEnvelope = {
    data: TriageNoteCreateManyCreatedByInput | TriageNoteCreateManyCreatedByInput[]
    skipDuplicates?: boolean
  }

  export type HospitalUpsertWithoutUsersInput = {
    update: XOR<HospitalUpdateWithoutUsersInput, HospitalUncheckedUpdateWithoutUsersInput>
    create: XOR<HospitalCreateWithoutUsersInput, HospitalUncheckedCreateWithoutUsersInput>
    where?: HospitalWhereInput
  }

  export type HospitalUpdateToOneWithWhereWithoutUsersInput = {
    where?: HospitalWhereInput
    data: XOR<HospitalUpdateWithoutUsersInput, HospitalUncheckedUpdateWithoutUsersInput>
  }

  export type HospitalUpdateWithoutUsersInput = {
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    encounters?: EncounterUpdateManyWithoutHospitalNestedInput
  }

  export type HospitalUncheckedUpdateWithoutUsersInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    encounters?: EncounterUncheckedUpdateManyWithoutHospitalNestedInput
  }

  export type TriageNoteUpsertWithWhereUniqueWithoutCreatedByInput = {
    where: TriageNoteWhereUniqueInput
    update: XOR<TriageNoteUpdateWithoutCreatedByInput, TriageNoteUncheckedUpdateWithoutCreatedByInput>
    create: XOR<TriageNoteCreateWithoutCreatedByInput, TriageNoteUncheckedCreateWithoutCreatedByInput>
  }

  export type TriageNoteUpdateWithWhereUniqueWithoutCreatedByInput = {
    where: TriageNoteWhereUniqueInput
    data: XOR<TriageNoteUpdateWithoutCreatedByInput, TriageNoteUncheckedUpdateWithoutCreatedByInput>
  }

  export type TriageNoteUpdateManyWithWhereWithoutCreatedByInput = {
    where: TriageNoteScalarWhereInput
    data: XOR<TriageNoteUpdateManyMutationInput, TriageNoteUncheckedUpdateManyWithoutCreatedByInput>
  }

  export type TriageNoteScalarWhereInput = {
    AND?: TriageNoteScalarWhereInput | TriageNoteScalarWhereInput[]
    OR?: TriageNoteScalarWhereInput[]
    NOT?: TriageNoteScalarWhereInput | TriageNoteScalarWhereInput[]
    id?: IntFilter<"TriageNote"> | number
    createdAt?: DateTimeFilter<"TriageNote"> | Date | string
    note?: StringFilter<"TriageNote"> | string
    userId?: IntNullableFilter<"TriageNote"> | number | null
    encounterId?: IntFilter<"TriageNote"> | number
  }

  export type EncounterCreateWithoutPatientInput = {
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospital?: HospitalCreateNestedOneWithoutEncountersInput
    triageNotes?: TriageNoteCreateNestedManyWithoutEncounterInput
    messages?: MessageCreateNestedManyWithoutEncounterInput
  }

  export type EncounterUncheckedCreateWithoutPatientInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospitalId?: number | null
    triageNotes?: TriageNoteUncheckedCreateNestedManyWithoutEncounterInput
    messages?: MessageUncheckedCreateNestedManyWithoutEncounterInput
  }

  export type EncounterCreateOrConnectWithoutPatientInput = {
    where: EncounterWhereUniqueInput
    create: XOR<EncounterCreateWithoutPatientInput, EncounterUncheckedCreateWithoutPatientInput>
  }

  export type EncounterCreateManyPatientInputEnvelope = {
    data: EncounterCreateManyPatientInput | EncounterCreateManyPatientInput[]
    skipDuplicates?: boolean
  }

  export type EncounterUpsertWithWhereUniqueWithoutPatientInput = {
    where: EncounterWhereUniqueInput
    update: XOR<EncounterUpdateWithoutPatientInput, EncounterUncheckedUpdateWithoutPatientInput>
    create: XOR<EncounterCreateWithoutPatientInput, EncounterUncheckedCreateWithoutPatientInput>
  }

  export type EncounterUpdateWithWhereUniqueWithoutPatientInput = {
    where: EncounterWhereUniqueInput
    data: XOR<EncounterUpdateWithoutPatientInput, EncounterUncheckedUpdateWithoutPatientInput>
  }

  export type EncounterUpdateManyWithWhereWithoutPatientInput = {
    where: EncounterScalarWhereInput
    data: XOR<EncounterUpdateManyMutationInput, EncounterUncheckedUpdateManyWithoutPatientInput>
  }

  export type HospitalCreateWithoutEncountersInput = {
    name: string
    slug: string
    users?: UserCreateNestedManyWithoutHospitalInput
  }

  export type HospitalUncheckedCreateWithoutEncountersInput = {
    id?: number
    name: string
    slug: string
    users?: UserUncheckedCreateNestedManyWithoutHospitalInput
  }

  export type HospitalCreateOrConnectWithoutEncountersInput = {
    where: HospitalWhereUniqueInput
    create: XOR<HospitalCreateWithoutEncountersInput, HospitalUncheckedCreateWithoutEncountersInput>
  }

  export type PatientCreateWithoutEncountersInput = {
    displayName: string
    phone?: string | null
  }

  export type PatientUncheckedCreateWithoutEncountersInput = {
    id?: number
    displayName: string
    phone?: string | null
  }

  export type PatientCreateOrConnectWithoutEncountersInput = {
    where: PatientWhereUniqueInput
    create: XOR<PatientCreateWithoutEncountersInput, PatientUncheckedCreateWithoutEncountersInput>
  }

  export type TriageNoteCreateWithoutEncounterInput = {
    createdAt?: Date | string
    note: string
    createdBy?: UserCreateNestedOneWithoutTriageNotesInput
  }

  export type TriageNoteUncheckedCreateWithoutEncounterInput = {
    id?: number
    createdAt?: Date | string
    note: string
    userId?: number | null
  }

  export type TriageNoteCreateOrConnectWithoutEncounterInput = {
    where: TriageNoteWhereUniqueInput
    create: XOR<TriageNoteCreateWithoutEncounterInput, TriageNoteUncheckedCreateWithoutEncounterInput>
  }

  export type TriageNoteCreateManyEncounterInputEnvelope = {
    data: TriageNoteCreateManyEncounterInput | TriageNoteCreateManyEncounterInput[]
    skipDuplicates?: boolean
  }

  export type MessageCreateWithoutEncounterInput = {
    createdAt?: Date | string
    from: $Enums.MessageAuthor
    content: string
  }

  export type MessageUncheckedCreateWithoutEncounterInput = {
    id?: number
    createdAt?: Date | string
    from: $Enums.MessageAuthor
    content: string
  }

  export type MessageCreateOrConnectWithoutEncounterInput = {
    where: MessageWhereUniqueInput
    create: XOR<MessageCreateWithoutEncounterInput, MessageUncheckedCreateWithoutEncounterInput>
  }

  export type MessageCreateManyEncounterInputEnvelope = {
    data: MessageCreateManyEncounterInput | MessageCreateManyEncounterInput[]
    skipDuplicates?: boolean
  }

  export type HospitalUpsertWithoutEncountersInput = {
    update: XOR<HospitalUpdateWithoutEncountersInput, HospitalUncheckedUpdateWithoutEncountersInput>
    create: XOR<HospitalCreateWithoutEncountersInput, HospitalUncheckedCreateWithoutEncountersInput>
    where?: HospitalWhereInput
  }

  export type HospitalUpdateToOneWithWhereWithoutEncountersInput = {
    where?: HospitalWhereInput
    data: XOR<HospitalUpdateWithoutEncountersInput, HospitalUncheckedUpdateWithoutEncountersInput>
  }

  export type HospitalUpdateWithoutEncountersInput = {
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    users?: UserUpdateManyWithoutHospitalNestedInput
  }

  export type HospitalUncheckedUpdateWithoutEncountersInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    users?: UserUncheckedUpdateManyWithoutHospitalNestedInput
  }

  export type PatientUpsertWithoutEncountersInput = {
    update: XOR<PatientUpdateWithoutEncountersInput, PatientUncheckedUpdateWithoutEncountersInput>
    create: XOR<PatientCreateWithoutEncountersInput, PatientUncheckedCreateWithoutEncountersInput>
    where?: PatientWhereInput
  }

  export type PatientUpdateToOneWithWhereWithoutEncountersInput = {
    where?: PatientWhereInput
    data: XOR<PatientUpdateWithoutEncountersInput, PatientUncheckedUpdateWithoutEncountersInput>
  }

  export type PatientUpdateWithoutEncountersInput = {
    displayName?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type PatientUncheckedUpdateWithoutEncountersInput = {
    id?: IntFieldUpdateOperationsInput | number
    displayName?: StringFieldUpdateOperationsInput | string
    phone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type TriageNoteUpsertWithWhereUniqueWithoutEncounterInput = {
    where: TriageNoteWhereUniqueInput
    update: XOR<TriageNoteUpdateWithoutEncounterInput, TriageNoteUncheckedUpdateWithoutEncounterInput>
    create: XOR<TriageNoteCreateWithoutEncounterInput, TriageNoteUncheckedCreateWithoutEncounterInput>
  }

  export type TriageNoteUpdateWithWhereUniqueWithoutEncounterInput = {
    where: TriageNoteWhereUniqueInput
    data: XOR<TriageNoteUpdateWithoutEncounterInput, TriageNoteUncheckedUpdateWithoutEncounterInput>
  }

  export type TriageNoteUpdateManyWithWhereWithoutEncounterInput = {
    where: TriageNoteScalarWhereInput
    data: XOR<TriageNoteUpdateManyMutationInput, TriageNoteUncheckedUpdateManyWithoutEncounterInput>
  }

  export type MessageUpsertWithWhereUniqueWithoutEncounterInput = {
    where: MessageWhereUniqueInput
    update: XOR<MessageUpdateWithoutEncounterInput, MessageUncheckedUpdateWithoutEncounterInput>
    create: XOR<MessageCreateWithoutEncounterInput, MessageUncheckedCreateWithoutEncounterInput>
  }

  export type MessageUpdateWithWhereUniqueWithoutEncounterInput = {
    where: MessageWhereUniqueInput
    data: XOR<MessageUpdateWithoutEncounterInput, MessageUncheckedUpdateWithoutEncounterInput>
  }

  export type MessageUpdateManyWithWhereWithoutEncounterInput = {
    where: MessageScalarWhereInput
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyWithoutEncounterInput>
  }

  export type MessageScalarWhereInput = {
    AND?: MessageScalarWhereInput | MessageScalarWhereInput[]
    OR?: MessageScalarWhereInput[]
    NOT?: MessageScalarWhereInput | MessageScalarWhereInput[]
    id?: IntFilter<"Message"> | number
    createdAt?: DateTimeFilter<"Message"> | Date | string
    from?: EnumMessageAuthorFilter<"Message"> | $Enums.MessageAuthor
    content?: StringFilter<"Message"> | string
    encounterId?: IntFilter<"Message"> | number
  }

  export type UserCreateWithoutTriageNotesInput = {
    email: string
    password: string
    role: $Enums.Role
    hospital: HospitalCreateNestedOneWithoutUsersInput
  }

  export type UserUncheckedCreateWithoutTriageNotesInput = {
    id?: number
    email: string
    password: string
    role: $Enums.Role
    hospitalId: number
  }

  export type UserCreateOrConnectWithoutTriageNotesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutTriageNotesInput, UserUncheckedCreateWithoutTriageNotesInput>
  }

  export type EncounterCreateWithoutTriageNotesInput = {
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospital?: HospitalCreateNestedOneWithoutEncountersInput
    patient: PatientCreateNestedOneWithoutEncountersInput
    messages?: MessageCreateNestedManyWithoutEncounterInput
  }

  export type EncounterUncheckedCreateWithoutTriageNotesInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospitalId?: number | null
    patientId: number
    messages?: MessageUncheckedCreateNestedManyWithoutEncounterInput
  }

  export type EncounterCreateOrConnectWithoutTriageNotesInput = {
    where: EncounterWhereUniqueInput
    create: XOR<EncounterCreateWithoutTriageNotesInput, EncounterUncheckedCreateWithoutTriageNotesInput>
  }

  export type UserUpsertWithoutTriageNotesInput = {
    update: XOR<UserUpdateWithoutTriageNotesInput, UserUncheckedUpdateWithoutTriageNotesInput>
    create: XOR<UserCreateWithoutTriageNotesInput, UserUncheckedCreateWithoutTriageNotesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutTriageNotesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutTriageNotesInput, UserUncheckedUpdateWithoutTriageNotesInput>
  }

  export type UserUpdateWithoutTriageNotesInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    hospital?: HospitalUpdateOneRequiredWithoutUsersNestedInput
  }

  export type UserUncheckedUpdateWithoutTriageNotesInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    hospitalId?: IntFieldUpdateOperationsInput | number
  }

  export type EncounterUpsertWithoutTriageNotesInput = {
    update: XOR<EncounterUpdateWithoutTriageNotesInput, EncounterUncheckedUpdateWithoutTriageNotesInput>
    create: XOR<EncounterCreateWithoutTriageNotesInput, EncounterUncheckedCreateWithoutTriageNotesInput>
    where?: EncounterWhereInput
  }

  export type EncounterUpdateToOneWithWhereWithoutTriageNotesInput = {
    where?: EncounterWhereInput
    data: XOR<EncounterUpdateWithoutTriageNotesInput, EncounterUncheckedUpdateWithoutTriageNotesInput>
  }

  export type EncounterUpdateWithoutTriageNotesInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospital?: HospitalUpdateOneWithoutEncountersNestedInput
    patient?: PatientUpdateOneRequiredWithoutEncountersNestedInput
    messages?: MessageUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterUncheckedUpdateWithoutTriageNotesInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospitalId?: NullableIntFieldUpdateOperationsInput | number | null
    patientId?: IntFieldUpdateOperationsInput | number
    messages?: MessageUncheckedUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterCreateWithoutMessagesInput = {
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospital?: HospitalCreateNestedOneWithoutEncountersInput
    patient: PatientCreateNestedOneWithoutEncountersInput
    triageNotes?: TriageNoteCreateNestedManyWithoutEncounterInput
  }

  export type EncounterUncheckedCreateWithoutMessagesInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospitalId?: number | null
    patientId: number
    triageNotes?: TriageNoteUncheckedCreateNestedManyWithoutEncounterInput
  }

  export type EncounterCreateOrConnectWithoutMessagesInput = {
    where: EncounterWhereUniqueInput
    create: XOR<EncounterCreateWithoutMessagesInput, EncounterUncheckedCreateWithoutMessagesInput>
  }

  export type EncounterUpsertWithoutMessagesInput = {
    update: XOR<EncounterUpdateWithoutMessagesInput, EncounterUncheckedUpdateWithoutMessagesInput>
    create: XOR<EncounterCreateWithoutMessagesInput, EncounterUncheckedCreateWithoutMessagesInput>
    where?: EncounterWhereInput
  }

  export type EncounterUpdateToOneWithWhereWithoutMessagesInput = {
    where?: EncounterWhereInput
    data: XOR<EncounterUpdateWithoutMessagesInput, EncounterUncheckedUpdateWithoutMessagesInput>
  }

  export type EncounterUpdateWithoutMessagesInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospital?: HospitalUpdateOneWithoutEncountersNestedInput
    patient?: PatientUpdateOneRequiredWithoutEncountersNestedInput
    triageNotes?: TriageNoteUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterUncheckedUpdateWithoutMessagesInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospitalId?: NullableIntFieldUpdateOperationsInput | number | null
    patientId?: IntFieldUpdateOperationsInput | number
    triageNotes?: TriageNoteUncheckedUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterCreateManyHospitalInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    patientId: number
  }

  export type UserCreateManyHospitalInput = {
    id?: number
    email: string
    password: string
    role: $Enums.Role
  }

  export type EncounterUpdateWithoutHospitalInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    patient?: PatientUpdateOneRequiredWithoutEncountersNestedInput
    triageNotes?: TriageNoteUpdateManyWithoutEncounterNestedInput
    messages?: MessageUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterUncheckedUpdateWithoutHospitalInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    patientId?: IntFieldUpdateOperationsInput | number
    triageNotes?: TriageNoteUncheckedUpdateManyWithoutEncounterNestedInput
    messages?: MessageUncheckedUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterUncheckedUpdateManyWithoutHospitalInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    patientId?: IntFieldUpdateOperationsInput | number
  }

  export type UserUpdateWithoutHospitalInput = {
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    triageNotes?: TriageNoteUpdateManyWithoutCreatedByNestedInput
  }

  export type UserUncheckedUpdateWithoutHospitalInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    triageNotes?: TriageNoteUncheckedUpdateManyWithoutCreatedByNestedInput
  }

  export type UserUncheckedUpdateManyWithoutHospitalInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    password?: StringFieldUpdateOperationsInput | string
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
  }

  export type TriageNoteCreateManyCreatedByInput = {
    id?: number
    createdAt?: Date | string
    note: string
    encounterId: number
  }

  export type TriageNoteUpdateWithoutCreatedByInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    encounter?: EncounterUpdateOneRequiredWithoutTriageNotesNestedInput
  }

  export type TriageNoteUncheckedUpdateWithoutCreatedByInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    encounterId?: IntFieldUpdateOperationsInput | number
  }

  export type TriageNoteUncheckedUpdateManyWithoutCreatedByInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    encounterId?: IntFieldUpdateOperationsInput | number
  }

  export type EncounterCreateManyPatientInput = {
    id?: number
    createdAt?: Date | string
    updatedAt?: Date | string
    status?: $Enums.EncounterStatus
    hospitalName: string
    chiefComplaint: string
    details?: string | null
    hospitalId?: number | null
  }

  export type EncounterUpdateWithoutPatientInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospital?: HospitalUpdateOneWithoutEncountersNestedInput
    triageNotes?: TriageNoteUpdateManyWithoutEncounterNestedInput
    messages?: MessageUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterUncheckedUpdateWithoutPatientInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospitalId?: NullableIntFieldUpdateOperationsInput | number | null
    triageNotes?: TriageNoteUncheckedUpdateManyWithoutEncounterNestedInput
    messages?: MessageUncheckedUpdateManyWithoutEncounterNestedInput
  }

  export type EncounterUncheckedUpdateManyWithoutPatientInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    status?: EnumEncounterStatusFieldUpdateOperationsInput | $Enums.EncounterStatus
    hospitalName?: StringFieldUpdateOperationsInput | string
    chiefComplaint?: StringFieldUpdateOperationsInput | string
    details?: NullableStringFieldUpdateOperationsInput | string | null
    hospitalId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type TriageNoteCreateManyEncounterInput = {
    id?: number
    createdAt?: Date | string
    note: string
    userId?: number | null
  }

  export type MessageCreateManyEncounterInput = {
    id?: number
    createdAt?: Date | string
    from: $Enums.MessageAuthor
    content: string
  }

  export type TriageNoteUpdateWithoutEncounterInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    createdBy?: UserUpdateOneWithoutTriageNotesNestedInput
  }

  export type TriageNoteUncheckedUpdateWithoutEncounterInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    userId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type TriageNoteUncheckedUpdateManyWithoutEncounterInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    note?: StringFieldUpdateOperationsInput | string
    userId?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type MessageUpdateWithoutEncounterInput = {
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    from?: EnumMessageAuthorFieldUpdateOperationsInput | $Enums.MessageAuthor
    content?: StringFieldUpdateOperationsInput | string
  }

  export type MessageUncheckedUpdateWithoutEncounterInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    from?: EnumMessageAuthorFieldUpdateOperationsInput | $Enums.MessageAuthor
    content?: StringFieldUpdateOperationsInput | string
  }

  export type MessageUncheckedUpdateManyWithoutEncounterInput = {
    id?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    from?: EnumMessageAuthorFieldUpdateOperationsInput | $Enums.MessageAuthor
    content?: StringFieldUpdateOperationsInput | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}