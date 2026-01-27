export interface WalletWithDetails {
  id: string
  address: string
  name: string | null
  chainId: number
  tag: string | null
  threshold: number
  nonce: number
  totalSigners: number
  signers: SignerWithAddress[]
  createdAt: Date
  updatedAt: Date
  _apiError?: string // Internal flag for API errors (not exposed to client)
}

export interface SignerWithAddress {
  address: string
  signerName: string | null
  signerId: string | null
  department: string | null
}

export interface SignerWithWallets {
  id: string
  name: string
  department: string | null
  addresses: SignerAddress[]
  wallets: WalletBasicInfo[]
  createdAt: Date
  updatedAt: Date
}

export interface SignerAddress {
  id: string
  address: string
  createdAt: Date
}

export interface WalletBasicInfo {
  id: string
  address: string
  name: string | null
  chainId: number
  tag: string | null
  threshold: number
  totalSigners: number
}
